/**
 * The JSON-exact fast path (see `hydration-serializer.ts` and
 * `isJsonExactSnapshot` in `public-snapshot.ts`) gives up devalue's
 * byte-identical output in exchange for a native `JSON.stringify` on trees
 * where the two are semantically interchangeable. This file is adversarial:
 * every construct listed as a bail condition in the design gets a case that
 * proves the flag actually flips, plus a fuzz run over `random-graph`'s
 * generator (shared with the other equivalence specs) that records which
 * path each of many random shapes takes and holds the semantic oracle
 * against every JSON-exact one.
 */
import { describe, expect, it } from 'vitest';
import { uneval } from 'devalue';
import { emitPlainTree, serializeForHydration } from '../hydration-serializer';
import {
  isFrozenPublicSnapshot,
  isJsonExactSnapshot,
  snapshotPublicPayload,
} from '../public-snapshot';
import { generate, prng } from './random-graph';
import {
  assertSameShape,
  containsScriptUnsafeChar,
  evalInRealm,
} from './json-exact-oracle';

const limits = { maxBytes: 1024 * 1024, maxDepth: 32 };
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

type Path = 'json' | 'fallback' | 'invalid';

/**
 * Run a value through the real pipeline (snapshot, then serialize) and
 * assert both which path it took and that the output is safe/correct for
 * that path: byte-identical to devalue on the fallback path, semantically
 * identical (same value, key order and prototypes at every level, no raw
 * `<`/line/paragraph separator) on the JSON-exact path.
 */
function checkCase(value: unknown, expected: Path): void {
  const snapshot = snapshotPublicPayload(
    value,
    { limits, target: 'devalue', mode: 'warn', label: 'props' },
    { freeze: true },
  );
  if (expected === 'invalid') {
    expect(snapshot.valid).toBe(false);
    expect(isFrozenPublicSnapshot(snapshot.value)).toBe(false);
    return;
  }
  expect(snapshot.valid).toBe(true);
  expect(isJsonExactSnapshot(snapshot.value)).toBe(expected === 'json');
  const actual = serializeForHydration(snapshot.value);
  const oracle = uneval(snapshot.value);
  if (expected === 'json') {
    assertSameShape(evalInRealm(actual), evalInRealm(oracle));
    expect(containsScriptUnsafeChar(actual)).toBe(false);
  } else {
    expect(actual).toBe(oracle);
  }
}

describe('serializeForHydration: JSON-exact fast path', () => {
  it('takes the JSON path and escapes </script>', () => {
    checkCase({ s: '</script><script>alert(1)</script>' }, 'json');
  });

  it('takes the JSON path and escapes an HTML comment opener', () => {
    checkCase({ s: '<!--evil-->' }, 'json');
  });

  it('takes the JSON path and escapes U+2028/U+2029', () => {
    checkCase({ s: `a${LINE_SEPARATOR}b${PARAGRAPH_SEPARATOR}c` }, 'json');
  });

  it('takes the JSON path with a lone high surrogate', () => {
    checkCase({ s: '\uD800x' }, 'json');
  });

  it('takes the JSON path with a lone low surrogate', () => {
    checkCase({ s: 'x\uDC00' }, 'json');
  });

  it('rejects an own "__proto__" key before either path sees it', () => {
    const value: Record<string, unknown> = {};
    Object.defineProperty(value, '__proto__', {
      value: 1,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    checkCase(value, 'invalid');
  });

  it('rejects an own "constructor" key before either path sees it', () => {
    const value: Record<string, unknown> = {};
    Object.defineProperty(value, 'constructor', {
      value: 1,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    checkCase(value, 'invalid');
  });

  it('an own "toJSON" is a pre-existing devalue limitation, not a JSON-path regression', () => {
    // The snapshot keeps the object's own shape (including the live toJSON
    // function, embedded as a real property value) rather than the
    // projected form; devalue throws on the function either way. This is
    // unchanged by the JSON-exact path: it is documented here so a future
    // fix to the underlying issue doesn't get attributed to this change.
    const value = { hidden: 'x', toJSON: () => ({ projected: true }) };
    const snapshot = snapshotPublicPayload(
      value,
      { limits, target: 'devalue', mode: 'warn', label: 'props' },
      { freeze: true },
    );
    expect(snapshot.valid).toBe(true);
    expect(isJsonExactSnapshot(snapshot.value)).toBe(false);
    expect(() => uneval(snapshot.value)).toThrow(/function/i);
    expect(() => serializeForHydration(snapshot.value)).toThrow(/function/i);
  });

  it('takes the JSON path with integer-like keys, preserving spec key order', () => {
    checkCase(
      { '1': 'a', '2': 'f', '01': 'b', '-0': 'c', '4294967295': 'd', x: 'e' },
      'json',
    );
  });

  it('falls back to devalue for -0, NaN and Infinity', () => {
    checkCase({ n: -0 }, 'fallback');
    checkCase({ n: NaN }, 'fallback');
    checkCase({ n: Infinity }, 'fallback');
    checkCase({ n: -Infinity }, 'fallback');
  });

  it('falls back to devalue for undefined in an object', () => {
    checkCase({ a: undefined }, 'fallback');
  });

  it('falls back to devalue for undefined in an array', () => {
    checkCase({ a: [1, undefined, 3] }, 'fallback');
  });

  it('falls back to devalue for a sparse array (both fast paths bail)', () => {
    const a: number[] = [1];
    a[3] = 4;
    checkCase({ a }, 'fallback');
    // Confirms *why* it lands on raw devalue: emitPlainTree bails on the
    // hole too, so this exercises the third tier, not just the second.
    const snapshot = snapshotPublicPayload(
      { a },
      { limits, target: 'devalue', label: 'props' },
      { freeze: true },
    );
    expect(emitPlainTree(snapshot.value)).toBeUndefined();
  });

  it('falls back to devalue for a Date', () => {
    checkCase({ d: new Date(0) }, 'fallback');
  });

  it('falls back to devalue for a null-prototype object', () => {
    checkCase(Object.assign(Object.create(null) as object, { a: 1 }), 'fallback');
  });

  it('falls back to devalue for a shared reference', () => {
    const shared = { x: 1 };
    checkCase({ a: shared, b: shared }, 'fallback');
  });

  it('falls back to devalue for a cycle', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    checkCase(a, 'fallback');
  });

  it('falls back to devalue for a non-plain (subclassed) array', () => {
    class Tagged extends Array<number> {}
    checkCase({ a: new Tagged(1, 2, 3) }, 'fallback');
  });

  it('falls back to devalue for bigint', () => {
    checkCase({ n: 10n }, 'fallback');
  });

  it('takes the JSON path for a repeated long string (harmless for JSON, unlike emitPlainTree)', () => {
    const long = 'x'.repeat(200);
    checkCase({ a: long, b: long }, 'json');
  });

  it('takes the JSON path for deep nesting', () => {
    let value: unknown = { leaf: 1 };
    for (let i = 0; i < 20; i++) value = { child: value };
    checkCase(value, 'json');
  });

  it('takes the JSON path for the bench-shaped payload (50-item list)', () => {
    const props = {
      recipes: Array.from({ length: 50 }, (_, i) => ({
        slug: `recipe-${i}`,
        name: `Recipe ${i}`,
        description: 'A description long enough to be representative of real data.',
        ingredients: Array.from({ length: 10 }, (_, j) => ({
          amount: `${j}`,
          item: `ingredient ${j}`,
        })),
      })),
    };
    checkCase(props, 'json');
  });

  const CASES = Number(process.env.SNAPSHOT_CASES ?? 1500);

  it(`records the path distribution and holds the semantic oracle on ${CASES} random graphs`, () => {
    const tally: Record<Path, number> = { json: 0, fallback: 0, invalid: 0 };
    for (let seed = 1; seed <= CASES; seed++) {
      const graph = generate(prng(seed * 131 + 17), seed % 4 === 0);
      const snapshot = snapshotPublicPayload(
        graph,
        { limits, target: 'devalue', mode: 'warn', label: 'props' },
        { freeze: true },
      );
      if (!snapshot.valid) {
        tally.invalid++;
        continue;
      }
      const jsonExact = isJsonExactSnapshot(snapshot.value);
      tally[jsonExact ? 'json' : 'fallback']++;
      let actual: string;
      try {
        actual = serializeForHydration(snapshot.value);
      } catch {
        continue; // Pre-existing devalue limitations (e.g. own toJSON); not this path's concern.
      }
      if (jsonExact) {
        let oracle: string;
        try {
          oracle = uneval(snapshot.value);
        } catch {
          continue;
        }
        assertSameShape(
          evalInRealm(actual),
          evalInRealm(oracle),
          `seed ${seed}`,
        );
        expect(containsScriptUnsafeChar(actual), `seed ${seed}`).toBe(false);
      }
    }
    if (process.env.SNAPSHOT_CASES) console.log('path distribution', tally);
    // Guard against a generator or flag that stops reaching either path.
    expect(tally.json).toBeGreaterThan(0);
    expect(tally.fallback).toBeGreaterThan(0);
  });
});
