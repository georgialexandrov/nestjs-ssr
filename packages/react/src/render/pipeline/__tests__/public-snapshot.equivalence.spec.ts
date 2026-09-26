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

// Seeded PRNG so a failure is reproducible from its seed.
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Point {
  constructor(
    public x: number,
    public y: number,
  ) {}
}

class Money {
  constructor(private readonly cents: number) {}
  toJSON() {
    return { amount: this.cents / 100 };
  }
}

function generate(random: () => number, allowInvalid: boolean): unknown {
  const pool: object[] = [];
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];

  const leaf = (): unknown =>
    pick<() => unknown>([
      () => Math.floor(random() * 1000),
      () => random() * 10,
      () => pick(['', 'Ada', 'Grace Hopper', 'naïve café', '日本語', '🚀']),
      () => random() < 0.5,
      () => null,
      () => undefined,
      () => new Date(Math.floor(random() * 2e12)),
      () => (allowInvalid ? pick([NaN, Infinity, 10n]) : 1),
      () => (allowInvalid ? () => 'secret' : 'fn'),
    ])();

  const node = (depth: number): unknown => {
    if (depth > 5 || random() < 0.3) return leaf();
    if (pool.length && random() < 0.12) return pick(pool); // shared / cycle
    const kind = random();
    if (kind < 0.35) {
      const out: Record<string, unknown> = {};
      pool.push(out);
      const keys = Math.floor(random() * 5);
      for (let i = 0; i < keys; i++) {
        const key =
          allowInvalid && random() < 0.02
            ? '__proto__'
            : pick(['id', 'name', 'items', 'meta', 'ключ', 'x-y', `k${i}`]);
        if (key === '__proto__') {
          Object.defineProperty(out, key, {
            value: node(depth + 1),
            enumerable: true,
            configurable: true,
            writable: true,
          });
        } else {
          out[key] = node(depth + 1);
        }
      }
      return out;
    }
    if (kind < 0.55) {
      const out: unknown[] = [];
      pool.push(out);
      const length = Math.floor(random() * 5);
      for (let i = 0; i < length; i++) {
        if (random() < 0.1) continue; // leave a hole
        out[i] = node(depth + 1);
      }
      out.length = length;
      return out;
    }
    if (kind < 0.65) {
      const out = new Map<unknown, unknown>();
      pool.push(out);
      for (let i = 0; i < Math.floor(random() * 3); i++) {
        out.set(random() < 0.7 ? `key${i}` : node(depth + 1), node(depth + 1));
      }
      return out;
    }
    if (kind < 0.72) {
      const out = new Set<unknown>();
      pool.push(out);
      for (let i = 0; i < Math.floor(random() * 3); i++)
        out.add(node(depth + 1));
      return out;
    }
    if (kind < 0.78) {
      const out = Object.create(null) as Record<string, unknown>;
      pool.push(out);
      out.q = node(depth + 1);
      return out;
    }
    if (kind < 0.8) return /a+b/gi;
    if (kind < 0.84) {
      // The shapes where "checked on the copy" and "checked on the source"
      // differ: own and inherited `then`/`toJSON`, enumerable or not, as
      // data or accessor, and a Map subclass.
      return pick<() => unknown>([
        () => ({ then: () => 'thenable', id: 1 }),
        () => ({ then: 'not a function', id: 2 }),
        () => ({ toJSON: () => ({ projected: true }), hidden: 'x' }),
        () => {
          const out = { id: 3 };
          Object.defineProperty(out, 'then', {
            value: () => 'hidden',
            enumerable: false,
          });
          return out;
        },
        () => {
          let reads = 0;
          const out = { id: 4 } as Record<string, unknown>;
          Object.defineProperty(out, 'toJSON', {
            enumerable: true,
            get: () => (++reads === 1 ? () => ({ once: true }) : 'second read'),
          });
          return out;
        },
        () => Object.assign([1, 2], { then: () => 'array thenable' }),
        () => new (class Tagged extends Map {})([['k', 1]]),
      ])();
    }
    if (kind < 0.9) return new Money(Math.floor(random() * 10000));
    if (kind < 0.95) return new Point(1, 2);
    return { deep: { deeper: { deepest: node(depth + 1) } } };
  };

  return node(0);
}

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
