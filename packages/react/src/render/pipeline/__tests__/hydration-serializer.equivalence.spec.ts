/**
 * The hydration script must be byte-for-byte what devalue produced before
 * the single-pass fast path existed — for every tree that is *not*
 * JSON-exact. devalue itself is the oracle for that fallback path (plain
 * `emitPlainTree`, then `uneval`).
 *
 * A JSON-exact tree (see `isJsonExactSnapshot`) takes a third, faster path
 * that trades byte-identity for a weaker, but still verified, guarantee:
 * the JSON expression and the devalue expression evaluate to indistinguishable
 * values. `json-exact-oracle.ts` is that semantic oracle; the dedicated
 * `hydration-serializer.json-path.spec.ts` fuzzes it with adversarial input.
 * This file only needs to route each case to the right oracle.
 */
import { describe, expect, it } from 'vitest';
import { uneval } from 'devalue';
import { emitPlainTree, serializeForHydration } from '../hydration-serializer';
import { isJsonExactSnapshot, snapshotPublicPayload } from '../public-snapshot';
import { generate, prng } from './random-graph';
import {
  assertSameShape,
  containsScriptUnsafeChar,
  evalInRealm,
} from './json-exact-oracle';

const CASES = Number(process.env.SNAPSHOT_CASES ?? 1500);
const limits = { maxBytes: 1024 * 1024, maxDepth: 32 };

function oracle(value: unknown): string {
  try {
    return uneval(value);
  } catch (error) {
    return `throws: ${(error as Error).message}`;
  }
}

function subject(value: unknown): string {
  try {
    return serializeForHydration(value);
  } catch (error) {
    return `throws: ${(error as Error).message}`;
  }
}

describe('serializeForHydration matches devalue.uneval', () => {
  it(`on ${CASES} random frozen snapshots`, () => {
    let fastEligible = 0;
    let jsonExact = 0;
    for (let seed = 1; seed <= CASES; seed++) {
      const graph = generate(prng(seed * 97), seed % 4 === 0);
      const snapshot = snapshotPublicPayload(
        graph,
        { limits, target: 'devalue', mode: 'warn', label: 'props' },
        { freeze: true },
      );
      if (!snapshot.valid) continue;
      const label = `seed ${seed}`;
      if (isJsonExactSnapshot(snapshot.value)) {
        // Byte-identity is deliberately given up here: compare what the two
        // expressions evaluate to instead.
        jsonExact++;
        const actual = subject(snapshot.value);
        expect(actual.startsWith('throws:'), label).toBe(false);
        assertSameShape(
          evalInRealm(actual),
          evalInRealm(oracle(snapshot.value)),
        );
      } else {
        expect(subject(snapshot.value), label).toBe(oracle(snapshot.value));
      }
      if (emitPlainTree(snapshot.value) !== undefined) fastEligible++;
    }
    // Guard against a fast path that silently never runs.
    expect(fastEligible).toBeGreaterThan(CASES / 5);
    expect(jsonExact).toBeGreaterThan(0);
  });

  it('matches on the strings and keys devalue escapes', () => {
    const value = {
      plain: 'ascii',
      html: '</script><script>alert(1)</script>',
      quote: 'say "hi"',
      slash: 'back\\slash',
      controls: '\u0000\u0001\b\f\n\r\t\u001f',
      separators: 'a b c',
      unicode: 'naïve 日本語 🚀',
      'needs quotes': 1,
      'has<angle': 2,
      'line\nbreak': 3,
      $ok: 4,
      _ok: 5,
      '0': 'numeric key',
      '10': 'numeric key',
      'x-y': 'dash',
    };
    const snapshot = snapshotPublicPayload(
      value,
      { limits, target: 'devalue', label: 'props' },
      { freeze: true },
    );
    // This tree has no disqualifier (no Date, no NaN, no undefined, no
    // sharing), so it is JSON-exact: `serializeForHydration` no longer
    // matches devalue byte for byte (quoted keys), which is exactly what
    // giving up byte-identity for this path means. `emitPlainTree` itself is
    // unchanged, so it still reproduces devalue exactly on this input --
    // that regression guard is kept directly against the helper.
    expect(isJsonExactSnapshot(snapshot.value)).toBe(true);
    expect(emitPlainTree(snapshot.value)).toBe(uneval(snapshot.value));
    const actual = serializeForHydration(snapshot.value);
    assertSameShape(evalInRealm(actual), evalInRealm(uneval(snapshot.value)));
    expect(containsScriptUnsafeChar(actual)).toBe(false);
  });

  it('matches on numbers devalue formats specially', () => {
    const value = {
      numbers: [
        0,
        -0,
        0.5,
        -0.5,
        1e21,
        1e-7,
        123.456,
        NaN,
        Infinity,
        -Infinity,
      ],
      nothing: undefined,
      date: new Date(0),
      invalidDate: new Date(NaN),
      nullProto: Object.assign(Object.create(null) as object, { a: 1 }),
      emptyNullProto: Object.create(null) as object,
    };
    const snapshot = snapshotPublicPayload(
      value,
      { limits, target: 'devalue', label: 'props' },
      { freeze: true },
    );
    expect(snapshot.valid).toBe(true);
    // NaN/Infinity/-0, Date and a null-prototype object are all disqualifiers,
    // so this stays on the byte-identical fallback path.
    expect(isJsonExactSnapshot(snapshot.value)).toBe(false);
    expect(serializeForHydration(snapshot.value)).toBe(uneval(snapshot.value));
  });

  it('takes the JSON-exact path when a long string repeats (harmless for JSON, unlike emitPlainTree)', () => {
    const long = 'x'.repeat(200);
    const snapshot = snapshotPublicPayload(
      { a: long, b: long },
      { limits, target: 'devalue', label: 'props' },
      { freeze: true },
    );
    // Strings have no identity, so a repeated long string cannot break
    // JSON-exactness even though `emitPlainTree` itself still bails on it
    // (devalue hoists repeated long strings into a variable).
    expect(emitPlainTree(snapshot.value)).toBeUndefined();
    expect(isJsonExactSnapshot(snapshot.value)).toBe(true);
    const output = serializeForHydration(snapshot.value);
    expect(output).not.toContain('function(');
    assertSameShape(evalInRealm(output), evalInRealm(uneval(snapshot.value)));
  });

  it('uses devalue for anything that is not a frozen snapshot', () => {
    const shared = { id: 1 };
    const value = {
      a: shared,
      b: shared,
      get computed() {
        return 1;
      },
    };
    expect(serializeForHydration(value)).toBe(uneval(value));
  });
});
