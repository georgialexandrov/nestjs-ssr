/**
 * Direct, example-based coverage for the `toJSON` projection in
 * `snapshotPublicPayload` (see the fix's design note at the top of
 * `public-snapshot.ts`). The fuzz-based equivalence checks against the old
 * clone-then-validate oracle live in `public-snapshot.equivalence.spec.ts`
 * and `hydration-serializer.json-path.spec.ts`; this file is the readable,
 * one-shape-per-test record of the bug and the fix.
 */
import { describe, expect, it } from 'vitest';
import { uneval } from 'devalue';
import { isJsonExactSnapshot, snapshotPublicPayload } from '../public-snapshot';
import { serializeForHydration } from '../hydration-serializer';
import type { SerializationTarget } from '../safe-serialize';

const limits = { maxBytes: 1024 * 1024, maxDepth: 32 };

function snapshot(value: unknown, target: SerializationTarget = 'devalue') {
  return snapshotPublicPayload(
    value,
    { limits, target, mode: 'enforce', label: 'props' },
    { freeze: true },
  );
}

describe('snapshotPublicPayload: toJSON projection', () => {
  it('projects a prototype toJSON (class instance), not the instance shape', () => {
    class Money {
      constructor(private readonly cents: number) {}
      toJSON() {
        return { amount: this.cents / 100 };
      }
    }
    const result = snapshot({ price: new Money(1999) });

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({ price: { amount: 19.99 } });
    const price = (result.value as Record<string, unknown>).price;
    expect(Object.getPrototypeOf(price)).toBe(Object.prototype);
    expect(price).not.toBeInstanceOf(Money);
    // This is the bug: the old snapshot kept the Money instance, and devalue
    // cannot stringify a non-POJO. It must now just work.
    expect(() => serializeForHydration(result.value)).not.toThrow();
  });

  it('projects a plain object with an own toJSON function', () => {
    const inner = { hidden: 'x', toJSON: () => ({ projected: true }) };
    const result = snapshot({ v: inner });

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({ v: { projected: true } });
    expect(() => serializeForHydration(result.value)).not.toThrow();
  });

  it('projects a toJSON value nested inside an object', () => {
    class Id {
      toJSON() {
        return 'id-1';
      }
    }
    const result = snapshot({ user: { id: new Id(), name: 'Ada' } });

    expect(result.value).toEqual({ user: { id: 'id-1', name: 'Ada' } });
  });

  it('projects a toJSON value nested inside an array', () => {
    class Id {
      constructor(private readonly n: number) {}
      toJSON() {
        return `id-${this.n}`;
      }
    }
    const result = snapshot({ ids: [new Id(1), new Id(2)] });

    expect(result.value).toEqual({ ids: ['id-1', 'id-2'] });
  });

  it('supports toJSON returning a primitive', () => {
    class Cents {
      constructor(private readonly n: number) {}
      toJSON() {
        return this.n;
      }
    }
    const result = snapshot({ amount: new Cents(500) });

    expect(result.value).toEqual({ amount: 500 });
  });

  it('walks a toJSON result that itself contains toJSON values, without re-checking the result itself', () => {
    class Inner {
      toJSON() {
        return 'inner';
      }
    }
    let outerCalls = 0;
    const outer = {
      toJSON() {
        outerCalls++;
        return { inner: new Inner(), n: 1 };
      },
    };
    const result = snapshot({ outer });

    expect(result.value).toEqual({ outer: { inner: 'inner', n: 1 } });
    // Exactly one call: the projection's own shape (an own `toJSON` on the
    // *result* would be a second, unrelated slot, not this same one).
    expect(outerCalls).toBe(1);
  });

  it("calls toJSON with the value's own key, matching JSON.stringify: '' at the root, the object key, or the array index as a string", () => {
    const seenKeys: string[] = [];
    const tagged = () => ({
      toJSON(key: string) {
        seenKeys.push(key);
        return `k:${key}`;
      },
    });

    snapshot(tagged());
    snapshot({ a: tagged() });
    snapshot({ list: [tagged(), tagged()] });

    expect(seenKeys).toEqual(['', 'a', '0', '1']);
  });

  it('propagates a throwing toJSON uncaught, exactly like today', () => {
    const value = {
      toJSON() {
        throw new Error('boom');
      },
    };

    expect(() => snapshot({ value })).toThrow('boom');
  });

  it('marks the snapshot JSON-exact when the projection is a plain, JSON-safe shape', () => {
    class Money {
      constructor(private readonly cents: number) {}
      toJSON() {
        return { amount: this.cents / 100 };
      }
    }
    const result = snapshot({ price: new Money(1999) });

    expect(isJsonExactSnapshot(result.value)).toBe(true);
    expect(serializeForHydration(result.value)).toBe(
      JSON.stringify(result.value),
    );
  });

  it('is not JSON-exact when the projection itself is not (e.g. a Date)', () => {
    class Timestamped {
      toJSON() {
        return new Date(0);
      }
    }
    const result = snapshot({ at: new Timestamped() });

    expect(result.valid).toBe(true);
    expect((result.value as Record<string, unknown>).at).toEqual(
      new Date(0),
    );
    expect(isJsonExactSnapshot(result.value)).toBe(false);
    expect(serializeForHydration(result.value)).toBe(uneval(result.value));
  });

  it('calls toJSON once even when the same source is reached twice', () => {
    let calls = 0;
    const shared = {
      toJSON() {
        calls++;
        return { n: calls };
      },
    };
    const result = snapshot({ a: shared, b: shared });

    expect(calls).toBe(1);
    const value = result.value as Record<string, unknown>;
    // Same projected identity, exactly as any other shared reference would
    // be for the devalue target.
    expect(value.a).toBe(value.b);
    expect(value).toEqual({ a: { n: 1 }, b: { n: 1 } });
  });

  it('matches the JSON representation: same bytes, same evaluated shape', () => {
    class Money {
      constructor(private readonly cents: number) {}
      toJSON() {
        return { amount: this.cents / 100 };
      }
    }
    const value = { price: new Money(1999), label: 'Invoice' };

    const html = snapshot(value, 'devalue');
    const json = snapshot(value, 'json');

    expect(html.valid).toBe(true);
    expect(json.valid).toBe(true);
    expect(html.bytes).toBe(json.bytes);
    expect(html.value).toEqual(json.value);
    expect(JSON.stringify(html.value)).toBe(JSON.stringify(value));
  });
});
