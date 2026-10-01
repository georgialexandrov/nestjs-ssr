/**
 * The single-pass snapshot replaced "copy the graph, then validate the copy".
 * That older pair is kept here as the reference oracle, and random graphs are
 * run through both. Everything observable must match: whether the payload is
 * accepted, the exact diagnostic, the byte count, and what the client would
 * receive (the hydration serializer's output, or JSON for API bodies), which
 * captures shape, prototypes, holes, shared references and cycles.
 */
import { describe, expect, it } from 'vitest';
import { uneval } from 'devalue';
import {
  validatePublicPayload,
  type SerializationTarget,
  type ValidateOptions,
} from '../safe-serialize';
import { deepFreeze, snapshotPublicPayload } from '../public-snapshot';
import { generate, prng } from './random-graph';

/** The pre-snapshot structural copy, verbatim. */
function legacyClone<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (typeof value !== 'object' || value === null) return value;
  const source = value as unknown as object;
  const existing = seen.get(source);
  if (existing !== undefined) return existing as T;
  if (
    source instanceof Promise ||
    source instanceof WeakMap ||
    source instanceof WeakSet ||
    source instanceof ArrayBuffer ||
    ArrayBuffer.isView(source)
  ) {
    return value;
  }
  if (source instanceof Date) return new Date(source.getTime()) as T;
  if (source instanceof RegExp) {
    return new RegExp(source.source, source.flags) as T;
  }
  if (source instanceof Map) {
    const clone = new Map<unknown, unknown>();
    seen.set(source, clone);
    for (const [key, child] of source) {
      clone.set(legacyClone(key, seen), legacyClone(child, seen));
    }
    return clone as T;
  }
  if (source instanceof Set) {
    const clone = new Set<unknown>();
    seen.set(source, clone);
    for (const child of source) clone.add(legacyClone(child, seen));
    return clone as T;
  }
  const prototype = Reflect.getPrototypeOf(source);
  const clone: unknown[] | Record<string, unknown> = Array.isArray(source)
    ? []
    : (Object.create(prototype) as Record<string, unknown>);
  seen.set(source, clone);
  for (const key of Object.keys(source)) {
    Object.defineProperty(clone, key, {
      value: legacyClone((source as Record<string, unknown>)[key], seen),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return clone as T;
}

interface Outcome {
  valid: boolean;
  bytes: number;
  error?: string;
  violations: string[];
  wire?: string;
  frozen?: string[];
}

/**
 * Which objects of a snapshot are frozen, and whether Map/Set mutators are
 * blocked, listed in a deterministic traversal order (including array
 * properties that are not indices, which the freeze deliberately skips).
 */
function frozenSignature(root: unknown): string[] {
  const out: string[] = [];
  const visited = new Set<object>();
  const visit = (value: unknown, path: string): void => {
    if (typeof value !== 'object' || value === null) return;
    if (visited.has(value)) return;
    visited.add(value);
    let blocked = '';
    if (value instanceof Map || value instanceof Set) {
      blocked = Object.prototype.hasOwnProperty.call(value, 'delete')
        ? ' blocked'
        : '';
    }
    out.push(`${path} ${Object.isFrozen(value)}${blocked}`);
    if (value instanceof Map) {
      let i = 0;
      for (const [key, child] of value) {
        visit(key, `${path}<${i++}>`);
        visit(child, `${path}<${i++}>`);
      }
    } else if (value instanceof Set) {
      let i = 0;
      for (const child of value) visit(child, `${path}<${i++}>`);
    } else {
      for (const key of Object.keys(value)) {
        visit((value as Record<string, unknown>)[key], `${path}.${key}`);
      }
    }
  };
  visit(root, '$');
  return out;
}

function wire(value: unknown, target: SerializationTarget): string {
  return target === 'json' ? JSON.stringify(value) : uneval(value);
}

function run(
  implementation: (
    value: unknown,
    options: ValidateOptions,
  ) => { valid: boolean; bytes: number; value?: unknown },
  value: unknown,
  base: Omit<ValidateOptions, 'onViolation'>,
): Outcome {
  const violations: string[] = [];
  try {
    const result = implementation(value, {
      ...base,
      onViolation: (error) => violations.push(error.message),
    });
    let wired: string | undefined;
    try {
      wired = result.valid ? wire(result.value, base.target) : undefined;
    } catch (error) {
      wired = `unserializable: ${(error as Error).message}`;
    }
    return {
      valid: result.valid,
      bytes: result.bytes,
      violations,
      wire: wired,
      frozen: result.valid ? frozenSignature(result.value) : undefined,
    };
  } catch (error) {
    return {
      valid: false,
      bytes: -1,
      violations,
      error: (error as Error).message,
    };
  }
}

/** What the projector did before: copy, validate the copy, freeze it. */
const legacy = (value: unknown, options: ValidateOptions) => {
  const copy = legacyClone(value);
  const result = validatePublicPayload(copy, options);
  if (result.valid) deepFreeze(copy);
  return { ...result, value: copy };
};

const snapshot = (value: unknown, options: ValidateOptions) =>
  snapshotPublicPayload(value, options, { freeze: true });

const CASES = Number(process.env.SNAPSHOT_CASES ?? 1500);

describe('snapshotPublicPayload matches copy-then-validate', () => {
  for (const target of ['devalue', 'json'] as const) {
    for (const mode of ['enforce', 'warn'] as const) {
      it(`${target} target, ${mode} mode, ${CASES} random graphs`, () => {
        const tally = { accepted: 0, rejected: 0, warned: 0 };
        for (let seed = 1; seed <= CASES; seed++) {
          const allowInvalid = seed % 3 === 0;
          // Each implementation gets its own instance of the same graph:
          // some shapes carry state (an accessor that counts its reads).
          const fresh = () =>
            generate(
              prng(seed * 31 + (target === 'json' ? 7 : 0)),
              allowInvalid,
            );
          // Small limits on some seeds so the byte and depth paths run too.
          const limits = {
            maxBytes: seed % 5 === 0 ? 200 : 1024 * 1024,
            maxDepth: seed % 7 === 0 ? 3 : 32,
          };
          const base = { limits, target, mode, label: 'props' } as const;

          const expected = run(legacy, fresh(), base);
          const actual = run(snapshot, fresh(), base);
          expect(actual, `seed ${seed}`).toEqual(expected);
          tally[
            expected.error ? 'rejected' : expected.valid ? 'accepted' : 'warned'
          ]++;
        }
        // Guard against a generator that stops reaching every outcome.
        expect(tally.accepted).toBeGreaterThan(CASES / 10);
        expect(tally.rejected + tally.warned).toBeGreaterThan(CASES / 10);
        if (process.env.SNAPSHOT_CASES) console.log(target, mode, tally);
      });
    }
  }
});

describe('snapshotPublicPayload matches copy-then-validate on targeted shapes', () => {
  // Shapes where the snapshot's own bookkeeping (which nodes were visited)
  // could differ from the separate validator's.
  const shapes: Record<string, () => unknown> = {
    'toJSON returning this': () => ({
      a: {
        v: 1,
        toJSON() {
          return this;
        },
      },
    }),
    'toJSON returning a wrapper around this': () => ({
      a: {
        v: 1,
        toJSON() {
          return { self: this, n: 2 };
        },
      },
    }),
    'an object beneath toJSON that is also referenced directly': () => {
      const shared = { name: 'shared', tags: new Set(['x']) };
      const lookup = new Map([['k', shared]]);
      return {
        wrapped: {
          shared,
          lookup,
          toJSON: () => ({ id: 1 }),
        },
        direct: shared,
        again: lookup,
      };
    },
    'an array property that is not an index, shared with the tree': () => {
      const shared = { deep: { n: 1 } };
      const list = Object.assign([1, 2], { meta: shared });
      return { list, shared };
    },
    'a Map reached first beneath toJSON, then directly': () => {
      const map = new Map([[1, { a: 1 }]]);
      return [{ map, toJSON: () => 'x' }, map, map];
    },
    'a cycle through a plain object and an array': () => {
      const a: Record<string, unknown> = { name: 'a' };
      const b = [a];
      a.b = b;
      return { a, b };
    },
    'the same Date twice': () => {
      const date = new Date(0);
      return { a: date, b: date };
    },
  };

  for (const target of ['devalue', 'json'] as const) {
    for (const [name, shape] of Object.entries(shapes)) {
      it(`${target}: ${name}`, () => {
        const base = {
          limits: { maxBytes: 1024 * 1024, maxDepth: 32 },
          target,
          mode: 'enforce',
          label: 'props',
        } as const;
        expect(run(snapshot, shape(), base)).toEqual(
          run(legacy, shape(), base),
        );
      });
    }
  }
});
