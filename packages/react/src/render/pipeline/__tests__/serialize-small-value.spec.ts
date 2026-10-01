/**
 * `serializeSmallValueForHydration` is the fast path for values that are
 * never routed through `snapshotPublicPayload` before hydration — in
 * practice, `HeadData` (`window.__HEAD__`). It must be byte-identical to
 * `serializeForHydration` on the raw, unsnapshotted value for every input:
 * the plain-tree fast path when eligible, the existing fallback otherwise.
 */
import { describe, expect, it } from 'vitest';
import {
  isPlainHydratableValue,
  serializeForHydration,
  serializeSmallValueForHydration,
} from '../hydration-serializer';

function run(fn: () => string): string {
  try {
    return fn();
  } catch (error) {
    return `throws: ${(error as Error).message}`;
  }
}

function expectIdentical(value: unknown): void {
  expect(run(() => serializeSmallValueForHydration(value))).toBe(
    run(() => serializeForHydration(value)),
  );
}

describe('serializeSmallValueForHydration', () => {
  it('matches the general path on representative HeadData shapes', () => {
    const cases: unknown[] = [
      { title: 'With Dates' },
      { title: 'Home', description: 'A description', keywords: undefined },
      {
        title: 'Product',
        links: [
          { rel: 'canonical', href: 'https://example.com/p/1' },
          { rel: 'stylesheet', href: '/a.css', media: 'screen' },
        ],
        meta: [
          { name: 'description', content: 'hi' },
          { property: 'og:title', content: 'hi' },
        ],
      },
      { links: [], meta: [] },
      { title: undefined, description: undefined },
      {},
      { htmlAttributes: { lang: 'en', dir: 'ltr' }, bodyAttributes: {} },
      {
        title: 'Numbers',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        count: 0,
        neg: -0,
        float: 0.5,
        big: 1e21,
        bool: true,
        boolFalse: false,
      },
    ];
    for (const value of cases) expectIdentical(value);
  });

  it('matches on hostile strings (script-closing, angle brackets, quotes, separators)', () => {
    const cases: unknown[] = [
      { title: '</script><script>alert(1)</script>' },
      { title: 'say "hi"' },
      { title: 'a b c' },
      { title: 'back\\slash' },
      {
        meta: [{ name: 'x', content: '</script>' }],
        links: [{ rel: 'canonical', href: 'http://a/?x=1&y=</script>' }],
      },
      { title: 'naïve 日本語 🚀 </style>' },
    ];
    for (const value of cases) expectIdentical(value);
  });

  it('falls back correctly for values outside the plain-tree subset', () => {
    const shared = { id: 1 };
    const cases: unknown[] = [
      { generatedAt: new Date(0) },
      {
        get title() {
          return 'computed';
        },
      },
      { a: shared, b: shared }, // repeated reference: devalue dedupes
      { jsonLd: [Object.assign(Object.create({ toJSON: 1 }), { a: 1 })] },
      { nullProto: Object.assign(Object.create(null) as object, { a: 1 }) },
      { long: 'x'.repeat(200), long2: 'x'.repeat(200) }, // devalue hoists repeats
      { arr: (() => {
        const a: unknown[] = [1];
        a[3] = 4; // hole
        return a;
      })() },
      undefined,
      null,
    ];
    for (const value of cases) expectIdentical(value);
  });

  it('isPlainHydratableValue rejects getters, symbols, non-plain prototypes, holes, Dates', () => {
    expect(isPlainHydratableValue({ title: 'ok' })).toBe(true);
    expect(isPlainHydratableValue(undefined)).toBe(true);
    expect(isPlainHydratableValue(null)).toBe(true);
    expect(isPlainHydratableValue([1, 2, 3])).toBe(true);
    expect(isPlainHydratableValue({ get x() { return 1; } })).toBe(false);
    expect(isPlainHydratableValue({ [Symbol('s')]: 1 })).toBe(false);
    expect(isPlainHydratableValue(new Date())).toBe(false);
    expect(isPlainHydratableValue(Object.create({ a: 1 }))).toBe(false);
    const withHole: unknown[] = [1];
    withHole[2] = 3;
    expect(isPlainHydratableValue(withHole)).toBe(false);
    expect(isPlainHydratableValue(new Map())).toBe(false);
    expect(isPlainHydratableValue(() => {})).toBe(false);
  });

  it('produces no window.__HEAD__ = void 0 style output that differs from devalue for undefined', () => {
    expectIdentical(undefined);
  });
});
