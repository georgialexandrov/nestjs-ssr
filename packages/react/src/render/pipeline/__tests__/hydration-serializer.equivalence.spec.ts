/**
 * The hydration script must be byte-for-byte what devalue produced before
 * the single-pass fast path existed. devalue itself is the oracle.
 */
import { describe, expect, it } from 'vitest';
import { uneval } from 'devalue';
import { emitPlainTree, serializeForHydration } from '../hydration-serializer';
import { snapshotPublicPayload } from '../public-snapshot';
import { generate, prng } from './random-graph';

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
    for (let seed = 1; seed <= CASES; seed++) {
      const graph = generate(prng(seed * 97), seed % 4 === 0);
      const snapshot = snapshotPublicPayload(
        graph,
        { limits, target: 'devalue', mode: 'warn', label: 'props' },
        { freeze: true },
      );
      if (!snapshot.valid) continue;
      expect(subject(snapshot.value), `seed ${seed}`).toBe(
        oracle(snapshot.value),
      );
      if (emitPlainTree(snapshot.value) !== undefined) fastEligible++;
    }
    // Guard against a fast path that silently never runs.
    expect(fastEligible).toBeGreaterThan(CASES / 5);
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
    expect(serializeForHydration(snapshot.value)).toBe(uneval(snapshot.value));
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
    expect(serializeForHydration(snapshot.value)).toBe(uneval(snapshot.value));
  });

  it('defers to devalue when a long string repeats (devalue hoists it)', () => {
    const long = 'x'.repeat(200);
    const snapshot = snapshotPublicPayload(
      { a: long, b: long },
      { limits, target: 'devalue', label: 'props' },
      { freeze: true },
    );
    const output = serializeForHydration(snapshot.value);
    expect(output).toBe(uneval(snapshot.value));
    expect(output).toContain('function(');
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
