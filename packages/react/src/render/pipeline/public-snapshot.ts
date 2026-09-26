import { PayloadLimitError, PayloadSerializationError } from './errors';
import type { ValidateOptions } from './safe-serialize';

/** Whether `key` is an own enumerable property, i.e. one a copy would take. */
const isOwnEnumerable = (object: object, key: PropertyKey): boolean =>
  Object.prototype.propertyIsEnumerable.call(object, key);

/** Own keys that would let a payload reach `Object.prototype` on revival. */
const POLLUTING_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Identity map shared by the snapshot walk and the legacy structural copy. */
type CloneRegistry = Pick<Map<object, unknown>, 'get' | 'set' | 'has'>;

/**
 * Whether a value serializes as a plain object. Mirrors the hydration
 * serializer, which also accepts null-prototype objects (Express and Fastify
 * hand over `query` and `params` in that shape).
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
 * Read `key` of `source` for the copy, reusing an own `then`/`toJSON` value
 * that was already read for a check, so an accessor runs exactly once.
 */
function readKey(
  source: object,
  key: string,
  ownThen: boolean,
  thenValue: unknown,
  ownToJSON: boolean,
  toJSONValue: unknown,
): unknown {
  if (ownThen && key === 'then') return thenValue;
  if (ownToJSON && key === 'toJSON') return toJSONValue;
  return (source as Record<string, unknown>)[key];
}

/** Values the copy keeps by reference; validation rejects all of them. */
function isPassthrough(source: object): boolean {
  return (
    source instanceof Promise ||
    source instanceof WeakMap ||
    source instanceof WeakSet ||
    source instanceof ArrayBuffer ||
    ArrayBuffer.isView(source)
  );
}

/**
 * Structural copy used only beneath an object that defines `toJSON`: there
 * the payload is validated through the `toJSON` projection, but the snapshot
 * keeps the object's own shape. Shares the identity registry with the main
 * walk so shared references stay shared across the whole snapshot.
 */
function copyStructure(value: unknown, clones: CloneRegistry): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const source = value;
  if (clones.has(source)) return clones.get(source);
  if (isPassthrough(source)) return value;
  if (source instanceof Date) return new Date(source.getTime());
  if (source instanceof RegExp) return new RegExp(source.source, source.flags);

  if (source instanceof Map) {
    const clone = new Map<unknown, unknown>();
    clones.set(source, clone);
    for (const [key, child] of source) {
      clone.set(copyStructure(key, clones), copyStructure(child, clones));
    }
    return clone;
  }
  if (source instanceof Set) {
    const clone = new Set<unknown>();
    clones.set(source, clone);
    for (const child of source) clone.add(copyStructure(child, clones));
    return clone;
  }

  const clone: unknown[] | Record<string, unknown> = Array.isArray(source)
    ? []
    : (Object.create(Reflect.getPrototypeOf(source)) as Record<
        string,
        unknown
      >);
  clones.set(source, clone);
  for (const key of Object.keys(source)) {
    Object.defineProperty(clone, key, {
      value: copyStructure((source as Record<string, unknown>)[key], clones),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return clone;
}

/**
 * Recursively freeze a projected graph.
 *
 * Once projected, the payload is handed to renderers, the serializer, and
 * (in stream mode) code that runs after the response has begun. Freezing
 * makes it impossible for a later stage to add a field that never passed
 * through validation.
 */
export function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== 'object' || value === null) return value;
  const object = value as unknown as object;
  if (seen.has(object)) return value;
  seen.add(object);

  // Properties are read directly rather than through descriptors: the
  // validator has already walked this same graph, so any accessor has run,
  // and a descriptor lookup per key costs about as much as the freeze itself.
  if (object instanceof Map) {
    for (const [key, child] of object) {
      if (typeof key === 'object' && key !== null) deepFreeze(key, seen);
      if (typeof child === 'object' && child !== null) deepFreeze(child, seen);
    }
    const immutable = () => {
      throw new TypeError('Cannot mutate a projected public Map');
    };
    Object.defineProperties(object, {
      set: { value: immutable },
      delete: { value: immutable },
      clear: { value: immutable },
    });
  } else if (object instanceof Set) {
    for (const child of object) {
      if (typeof child === 'object' && child !== null) deepFreeze(child, seen);
    }
    const immutable = () => {
      throw new TypeError('Cannot mutate a projected public Set');
    };
    Object.defineProperties(object, {
      add: { value: immutable },
      delete: { value: immutable },
      clear: { value: immutable },
    });
  } else if (Array.isArray(object)) {
    for (let index = 0; index < object.length; index++) {
      const child: unknown = object[index];
      if (typeof child === 'object' && child !== null) deepFreeze(child, seen);
    }
  } else {
    for (const key of Object.keys(object)) {
      const child: unknown = (object as Record<string, unknown>)[key];
      if (typeof child === 'object' && child !== null) deepFreeze(child, seen);
    }
  }

  return Object.freeze(value);
}

/** Freeze one node the way {@link deepFreeze} does, without recursing. */
function freezeNode(object: object): void {
  if (object instanceof Map) {
    const immutable = () => {
      throw new TypeError('Cannot mutate a projected public Map');
    };
    Object.defineProperties(object, {
      set: { value: immutable },
      delete: { value: immutable },
      clear: { value: immutable },
    });
  } else if (object instanceof Set) {
    const immutable = () => {
      throw new TypeError('Cannot mutate a projected public Set');
    };
    Object.defineProperties(object, {
      add: { value: immutable },
      delete: { value: immutable },
      clear: { value: immutable },
    });
  }
  Object.freeze(object);
}

export interface SnapshotOptions {
  /**
   * Deep-freeze a valid snapshot, as {@link deepFreeze} would, while it is
   * built rather than in a second walk. Invalid (warn-mode) payloads are
   * never frozen: they are returned as the application's own objects.
   */
  freeze?: boolean;
}

export interface PublicSnapshot<T> {
  /** The detached copy when valid; the original value when warn mode let an invalid payload through. */
  value: T;
  /** Approximate serialized size in bytes. */
  bytes: number;
  valid: boolean;
}

/**
 * Detach and validate a client-visible payload in one walk.
 *
 * Equivalent to copying the graph and then running `validatePublicPayload`
 * over the copy, which is what this replaced: the same rules in the same
 * order, the same diagnostics (property path only, never a value), the same
 * byte accounting, and a copy with the same shape, prototypes, shared
 * references and cycles. Every accessor is read exactly once.
 *
 * It is faster for three reasons: the graph is walked once instead of twice;
 * plain objects are copied by assignment, which keeps V8's fast object
 * shapes, instead of `Object.defineProperty` per key, which pushed every copy
 * into slow dictionary mode for all later readers (React, the serializer);
 * and property paths are built only when a diagnostic needs one.
 */
export function snapshotPublicPayload<T>(
  root: T,
  options: ValidateOptions,
  snapshotOptions: SnapshotOptions = {},
): PublicSnapshot<T> {
  const { limits, target } = options;
  const warnOnly = options.mode === 'warn';
  const label = options.label ?? 'payload';
  let valid = true;
  let bytes = 0;

  // Path of the node being visited, stored raw and formatted only for a
  // diagnostic: an object key is a string (`.key`), an array index a
  // non-negative number (`[i]`), a Map/Set entry index `i` is stored as
  // `-(i + 1)` (`<i>`). Small integers do not allocate; template strings did.
  const segments: Array<string | number> = [];
  const pathAt = (suffix = ''): string => {
    let path = label;
    for (const segment of segments) {
      path +=
        typeof segment === 'string'
          ? `.${segment}`
          : segment >= 0
            ? `[${segment}]`
            : `<${-segment - 1}>`;
    }
    return path + suffix;
  };

  class StopWalk extends Error {}
  const raise = (
    error: PayloadLimitError | PayloadSerializationError,
  ): never => {
    if (!warnOnly) throw error;
    valid = false;
    options.onViolation?.(error);
    throw new StopWalk();
  };

  const addBytes = (amount: number): void => {
    bytes += amount;
    if (bytes > limits.maxBytes) {
      raise(
        new PayloadLimitError(
          `Serialized ${label} exceeds the configured limit of ${limits.maxBytes} bytes (at ${pathAt()})`,
          'bytes',
          limits.maxBytes,
        ),
      );
    }
  };

  const reject = (message: string, suffix = ''): never => {
    const path = pathAt(suffix);
    return raise(
      new PayloadSerializationError(
        `Cannot serialize ${label}: ${message} at ${path}`,
        path,
      ),
    );
  };

  // `clones` maps a source object to its copy; `seen` holds copies already
  // validated, exactly as the separate validator tracked the copied graph.
  const clones = new Map<object, unknown>();
  const seen = new Set<object>();

  // Every node of the finished snapshot, in visit order, so a valid result
  // can be frozen without walking it again. Subtrees copied structurally
  // (beneath a `toJSON` object) are frozen with a regular deepFreeze.
  const reached: object[] = [];
  const structuralRoots: unknown[] = [];

  /**
   * Visit one value. With `copy` it returns the value's snapshot; without,
   * it only validates (used for the output of `toJSON`, which is checked but
   * not stored).
   */
  const walk = (value: unknown, depth: number, copy: boolean): unknown => {
    if (depth > limits.maxDepth) {
      raise(
        new PayloadLimitError(
          `Serialized ${label} exceeds the configured depth limit of ${limits.maxDepth} (at ${pathAt()})`,
          'depth',
          limits.maxDepth,
        ),
      );
    }

    switch (typeof value) {
      case 'undefined':
        return value;
      case 'boolean':
        addBytes(5);
        return value;
      case 'number':
        // JSON turns non-finite numbers into null; devalue keeps them. Either
        // way the client would see something the server did not intend.
        if (!Number.isFinite(value) && target === 'json') {
          return reject(`non-finite number (${String(value)})`);
        }
        addBytes(String(value).length);
        return value;
      case 'string':
        addBytes(Buffer.byteLength(value, 'utf8') + 2);
        return value;
      case 'bigint':
        if (target === 'json') {
          return reject('bigint is not representable in JSON');
        }
        addBytes(String(value).length);
        return value;
      case 'function':
        return reject('functions cannot cross the response boundary');
      case 'symbol':
        return reject('symbols cannot cross the response boundary');
    }

    if (value === null) {
      addBytes(4);
      return null;
    }

    const source = value as object;
    const prototype: unknown = Object.getPrototypeOf(source);

    // The node the rules are applied to: the copy, as the validator saw it.
    let node: object;
    let fresh = false;
    // Whether the copy is built from the source's own enumerable keys (plain
    // and generic objects, arrays). Only then can an own `then` or `toJSON`
    // reach the copy; a Map, Set, Date or RegExp copy starts empty.
    let keyed = false;
    if (!copy || isPassthrough(source)) {
      node = source;
    } else if (clones.has(source)) {
      node = clones.get(source) as object;
    } else if (prototype === Object.prototype) {
      node = {};
      keyed = fresh = true;
      clones.set(source, node);
    } else if (Array.isArray(source)) {
      node = [];
      keyed = fresh = true;
      clones.set(source, node);
    } else if (source instanceof Date) {
      node = new Date(source.getTime());
    } else if (source instanceof RegExp) {
      node = new RegExp(source.source, source.flags);
    } else if (source instanceof Map) {
      node = new Map();
      fresh = true;
      clones.set(source, node);
    } else if (source instanceof Set) {
      node = new Set();
      fresh = true;
      clones.set(source, node);
    } else {
      node = Object.create(prototype as object | null) as object;
      keyed = fresh = true;
      clones.set(source, node);
    }

    // `then` and `toJSON` are checked as the finished copy will have them.
    // An own enumerable property is copied, so it is read from the source
    // once and the value reused for the copy; anything else resolves through
    // the copy's own prototype, exactly as it did on the finished copy.
    // (Plain locals rather than helpers: this runs for every node.)
    let thenValue: unknown;
    let ownThen = false;
    if (!fresh) {
      thenValue = (node as { then?: unknown }).then;
    } else if ('then' in source) {
      if (keyed && isOwnEnumerable(source, 'then')) {
        thenValue = (source as { then?: unknown }).then;
        ownThen = true;
      } else {
        thenValue = (node as { then?: unknown }).then;
      }
    }
    if (typeof thenValue === 'function') {
      return reject(
        'a promise reached the response boundary; await it in the controller',
      );
    }

    if (seen.has(node)) {
      if (target === 'json') return reject('circular reference');
      // A repeated node is serialized as a reference; already counted.
      return node;
    }
    seen.add(node);
    if (copy) reached.push(node);

    // An own enumerable `toJSON` is copied, so read it now, once. An
    // inherited one is looked up on the copy at the point the validator did.
    let ownToJSONValue: unknown;
    let ownToJSON = false;
    if (fresh && keyed && isOwnEnumerable(source, 'toJSON')) {
      ownToJSONValue = (source as { toJSON?: unknown }).toJSON;
      ownToJSON = true;
    }
    const reuse = ownThen || ownToJSON;

    // Fast path for the overwhelmingly common case: a plain object without
    // `toJSON`. None of the type checks below can apply to it.
    const plain = prototype === Object.prototype || prototype === null;
    if (
      !plain ||
      typeof (ownToJSON
        ? ownToJSONValue
        : (node as { toJSON?: unknown }).toJSON) === 'function'
    ) {
      if (Array.isArray(source)) {
        const out = node as unknown[];
        addBytes(2);
        // The copy is built from own keys, so it ends at the last present
        // element: trailing holes are dropped, and validation (which saw only
        // the copy) never visits them. Kept exactly for byte-identical output.
        let length = source.length;
        if (copy) {
          while (length > 0 && !(length - 1 in source)) length--;
        }
        let present = 0;
        for (let index = 0; index < length; index++) {
          addBytes(1);
          segments.push(index);
          const has = index in source;
          const child = walk(source[index], depth + 1, copy);
          segments.pop();
          // Holes stay holes: the hydration serializer encodes them distinctly.
          if (fresh && has) {
            out[index] = child;
            present++;
          }
        }
        // Non-index own properties were copied, never validated, as before.
        if (fresh && Object.keys(source).length !== present) {
          for (const key of Object.keys(source)) {
            if (!(String(Number(key)) === key && Number(key) < length)) {
              Object.defineProperty(out, key, {
                value: copyStructure(
                  readKey(
                    source,
                    key,
                    ownThen,
                    thenValue,
                    ownToJSON,
                    ownToJSONValue,
                  ),
                  clones,
                ),
                enumerable: true,
                configurable: true,
                writable: true,
              });
            }
          }
        }
        return node;
      }

      if (node instanceof Date) {
        addBytes(26);
        return node;
      }

      if (source instanceof Map || source instanceof Set) {
        if (target === 'json') {
          return reject(
            `${node.constructor.name} is not representable in JSON; convert it in the projector`,
          );
        }
        addBytes(4);
        let index = 0;
        if (source instanceof Map) {
          for (const [key, child] of source) {
            segments.push(-++index);
            const keyCopy = walk(key, depth + 1, copy);
            segments.pop();
            segments.push(-++index);
            const childCopy = walk(child, depth + 1, copy);
            segments.pop();
            if (fresh) (node as Map<unknown, unknown>).set(keyCopy, childCopy);
          }
        } else {
          for (const child of source) {
            segments.push(-++index);
            const childCopy = walk(child, depth + 1, copy);
            segments.pop();
            if (fresh) (node as Set<unknown>).add(childCopy);
          }
        }
        return node;
      }

      if (node instanceof RegExp) {
        if (target === 'json') {
          return reject(
            'RegExp is not representable in JSON; convert it in the projector',
          );
        }
        addBytes(node.source.length + 4);
        return node;
      }

      if (ArrayBuffer.isView(node) || node instanceof ArrayBuffer) {
        return reject(
          'binary data cannot cross the response boundary; encode it in the projector',
        );
      }

      if (
        typeof (ownToJSON
          ? ownToJSONValue
          : (node as { toJSON?: unknown }).toJSON) === 'function'
      ) {
        // The snapshot keeps the object's own shape; what is validated is the
        // form it serializes as, computed on the copy as the validator did.
        if (fresh) {
          for (const key of Object.keys(source)) {
            const child = copyStructure(
              readKey(
                source,
                key,
                ownThen,
                thenValue,
                ownToJSON,
                ownToJSONValue,
              ),
              clones,
            );
            structuralRoots.push(child);
            Object.defineProperty(node, key, {
              value: child,
              enumerable: true,
              configurable: true,
              writable: true,
            });
          }
        }
        const projected = (node as { toJSON: () => unknown }).toJSON();
        walk(projected, depth + 1, false);
        return node;
      }

      if (target === 'devalue' && !isPlainObject(node)) {
        // A class instance would arrive on the client as a plain object
        // without its methods. Rejecting here turns a late serializer crash
        // mid-render into a pre-commit error that names the property.
        return reject(
          `${describe(node)} is not a plain object; map it to a plain DTO in the projector`,
        );
      }
    }

    // Plain objects (Object.prototype or null prototype) take assignment,
    // which keeps fast object shapes. Other prototypes are copied with
    // defineProperty so an inherited setter cannot intercept the write.
    const out = node as Record<string, unknown>;
    addBytes(2);
    for (const key of Object.keys(source)) {
      if (POLLUTING_KEYS.has(key)) {
        return reject(
          `"${key}" is a prototype-polluting property name`,
          `.${key}`,
        );
      }
      addBytes(Buffer.byteLength(key, 'utf8') + 4);
      segments.push(key);
      const child = walk(
        reuse
          ? readKey(source, key, ownThen, thenValue, ownToJSON, ownToJSONValue)
          : (source as Record<string, unknown>)[key],
        depth + 1,
        copy,
      );
      segments.pop();
      if (!fresh) continue;
      if (plain) {
        out[key] = child;
      } else {
        Object.defineProperty(out, key, {
          value: child,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
    }
    return node;
  };

  try {
    const value = walk(root, 0, true) as T;
    if (!valid) return { value: root, bytes, valid };
    if (snapshotOptions.freeze) {
      const frozen = new WeakSet<object>();
      for (const child of structuralRoots) deepFreeze(child, frozen);
      for (const node of reached) {
        if (frozen.has(node)) continue;
        frozen.add(node);
        freezeNode(node);
      }
    }
    return { value, bytes, valid };
  } catch (error) {
    if (!(error instanceof StopWalk)) throw error;
    return { value: root, bytes, valid };
  }
}
