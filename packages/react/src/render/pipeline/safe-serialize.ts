import { PayloadLimitError, PayloadSerializationError } from './errors';

/** Effective limits for one payload. */
export interface SerializationLimits {
  maxBytes: number;
  maxDepth: number;
  /** Whether a violation refuses the payload or is only reported. */
  mode?: 'warn' | 'enforce';
}

/**
 * Which serializer the payload is destined for.
 *
 * `devalue` is the hydration payload (`window.__INITIAL_STATE__`), which
 * supports Map, Set, Date, RegExp, BigInt, and cycles. `json` is the API
 * body, where those become `{}` or throw, so they are rejected up front
 * instead of silently degrading.
 */
export type SerializationTarget = 'devalue' | 'json';

export interface ValidateOptions {
  limits: SerializationLimits;
  target: SerializationTarget;
  /** Root name used in diagnostics, e.g. `props` or `context`. */
  label?: string;
  /**
   * `enforce` throws on the first violation. `warn` collects them and lets the
   * payload through, so adopting this release cannot turn a page that renders
   * today into a 500.
   * @default 'enforce'
   */
  mode?: 'warn' | 'enforce';
  /** Called once per violation in `warn` mode. Never receives a value. */
  onViolation?: (error: PayloadLimitError | PayloadSerializationError) => void;
}

/** Own keys that would let a payload reach `Object.prototype` on revival. */
const POLLUTING_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Whether a value serializes as a plain object.
 *
 * Mirrors the hydration serializer's own rule, which also accepts
 * null-prototype objects — Express and Fastify both hand over `query` and
 * `params` in that shape, and a route that used to hydrate fine must not
 * start failing here.
 */
function isPlainObject(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype === null || prototype === Object.prototype) return true;
  return Object.getPrototypeOf(prototype) === null;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'object') {
    const name = value.constructor?.name;
    return name ? `${name} instance` : 'object';
  }
  return typeof value;
}

/**
 * Walk a client-visible payload, rejecting anything that cannot be safely
 * serialized and measuring its approximate serialized size.
 *
 * This runs before response headers are committed, so a rejected payload
 * becomes a controlled 500 rather than a half-written document or a body
 * containing a value the application never meant to publish.
 *
 * Diagnostics carry the property *path* only. The values are exactly what
 * might be sensitive, so they are never included in an error or a log line.
 */
export function validatePublicPayload(
  root: unknown,
  options: ValidateOptions,
): { bytes: number; valid: boolean } {
  const { limits, target } = options;
  const warnOnly = options.mode === 'warn';
  let valid = true;

  // In warn mode a violation is reported and the walk stops, because a graph
  // that broke one rule cannot be trusted to be measured further — but the
  // payload is still served. The report names the path, never the value.
  class StopWalk extends Error {}

  const raise = (
    error: PayloadLimitError | PayloadSerializationError,
  ): never => {
    if (!warnOnly) throw error;
    valid = false;
    options.onViolation?.(error);
    throw new StopWalk();
  };
  const label = options.label ?? 'payload';
  const seen = new Set<object>();
  let bytes = 0;

  const addBytes = (amount: number, path: string): void => {
    bytes += amount;
    if (bytes > limits.maxBytes) {
      raise(
        new PayloadLimitError(
          `Serialized ${label} exceeds the configured limit of ${limits.maxBytes} bytes (at ${path})`,
          'bytes',
          limits.maxBytes,
        ),
      );
    }
  };

  const reject = (path: string, message: string): never =>
    raise(
      new PayloadSerializationError(
        `Cannot serialize ${label}: ${message} at ${path}`,
        path,
      ),
    );

  const walk = (value: unknown, path: string, depth: number): void => {
    if (depth > limits.maxDepth) {
      raise(
        new PayloadLimitError(
          `Serialized ${label} exceeds the configured depth limit of ${limits.maxDepth} (at ${path})`,
          'depth',
          limits.maxDepth,
        ),
      );
    }

    switch (typeof value) {
      case 'undefined':
        return;
      case 'boolean':
        addBytes(5, path);
        return;
      case 'number':
        if (!Number.isFinite(value)) {
          // JSON turns these into null; devalue keeps them. Either way the
          // client sees something the server did not intend.
          if (target === 'json') {
            return reject(path, `non-finite number (${String(value)})`);
          }
        }
        addBytes(String(value).length, path);
        return;
      case 'string':
        addBytes(Buffer.byteLength(value, 'utf8') + 2, path);
        return;
      case 'bigint':
        if (target === 'json') {
          return reject(path, 'bigint is not representable in JSON');
        }
        addBytes(String(value).length, path);
        return;
      case 'function':
        return reject(path, 'functions cannot cross the response boundary');
      case 'symbol':
        return reject(path, 'symbols cannot cross the response boundary');
    }

    if (value === null) {
      addBytes(4, path);
      return;
    }

    const object = value as object;

    if (typeof (object as { then?: unknown }).then === 'function') {
      return reject(
        path,
        'a promise reached the response boundary; await it in the controller',
      );
    }

    if (seen.has(object)) {
      if (target === 'json') {
        return reject(path, 'circular reference');
      }
      // devalue emits a reference for a repeated node; it is already counted.
      return;
    }
    seen.add(object);

    if (Array.isArray(object)) {
      addBytes(2, path);
      for (let index = 0; index < object.length; index++) {
        addBytes(1, path);
        walk(object[index], `${path}[${index}]`, depth + 1);
      }
      return;
    }

    if (object instanceof Date) {
      addBytes(26, path);
      return;
    }

    if (object instanceof Map || object instanceof Set) {
      if (target === 'json') {
        return reject(
          path,
          `${object.constructor.name} is not representable in JSON; convert it in the projector`,
        );
      }
      addBytes(4, path);
      const entries: unknown[] =
        object instanceof Map
          ? Array.from(object.entries()).flat()
          : Array.from(object.values());
      for (let index = 0; index < entries.length; index++) {
        walk(entries[index], `${path}<${index}>`, depth + 1);
      }
      return;
    }

    if (object instanceof RegExp) {
      if (target === 'json') {
        return reject(
          path,
          'RegExp is not representable in JSON; convert it in the projector',
        );
      }
      addBytes(object.source.length + 4, path);
      return;
    }

    if (ArrayBuffer.isView(object) || object instanceof ArrayBuffer) {
      return reject(
        path,
        'binary data cannot cross the response boundary; encode it in the projector',
      );
    }

    if (typeof (object as { toJSON?: unknown }).toJSON === 'function') {
      // Trust the object's own JSON form, but still measure and check it.
      const projected = (object as { toJSON: () => unknown }).toJSON();
      walk(projected, path, depth + 1);
      return;
    }

    if (target === 'devalue' && !isPlainObject(object)) {
      // The hydration serializer cannot represent a class instance: it would
      // arrive on the client as a plain object without its methods. Rejecting
      // here turns a late serializer crash mid-render into a pre-commit error
      // that names the property.
      return reject(
        path,
        `${describe(object)} is not a plain object; map it to a plain DTO in the projector`,
      );
    }

    addBytes(2, path);
    for (const key of Object.keys(object)) {
      if (POLLUTING_KEYS.has(key)) {
        return reject(
          `${path}.${key}`,
          `"${key}" is a prototype-polluting property name`,
        );
      }
      addBytes(Buffer.byteLength(key, 'utf8') + 4, path);
      walk(
        (object as Record<string, unknown>)[key],
        `${path}.${key}`,
        depth + 1,
      );
    }
  };

  try {
    walk(root, label, 0);
  } catch (error) {
    if (!(error instanceof StopWalk)) throw error;
  }
  return { bytes, valid };
}
