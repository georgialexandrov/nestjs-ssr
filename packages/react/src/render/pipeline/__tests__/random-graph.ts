/**
 * Seeded random payload graphs for equivalence tests. Deterministic per seed,
 * so a failure names a reproducible case.
 */
// Seeded PRNG so a failure is reproducible from its seed.
export function prng(seed: number) {
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

export function generate(random: () => number, allowInvalid: boolean): unknown {
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
        () => new (class Tagged extends Map<string, number> {})([['k', 1]]),
      ])();
    }
    if (kind < 0.9) return new Money(Math.floor(random() * 10000));
    if (kind < 0.95) return new Point(1, 2);
    return { deep: { deeper: { deepest: node(depth + 1) } } };
  };

  return node(0);
}
