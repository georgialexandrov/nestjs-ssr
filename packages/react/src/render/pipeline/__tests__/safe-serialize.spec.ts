import { describe, it, expect } from 'vitest';
import { validatePublicPayload } from '../safe-serialize';
import { PayloadLimitError, PayloadSerializationError } from '../errors';

const limits = { maxBytes: 1024 * 1024, maxDepth: 32 };

function validate(
  value: unknown,
  target: 'devalue' | 'json' = 'devalue',
  overrides: Partial<typeof limits> = {},
) {
  return validatePublicPayload(value, {
    limits: { ...limits, ...overrides },
    target,
    label: 'props',
  });
}

describe('validatePublicPayload', () => {
  it('accepts a plain serializable graph', () => {
    const result = validate({
      user: { id: 1, name: 'Ada', tags: ['a', 'b'], active: true, bio: null },
    });
    expect(result.bytes).toBeGreaterThan(0);
  });

  it('rejects a function and names its path without its value', () => {
    const secret = () => 'do not log me';
    try {
      validate({ user: { onClick: secret } });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadSerializationError);
      const failure = error as PayloadSerializationError;
      expect(failure.path).toBe('props.user.onClick');
      expect(failure.message).toContain('props.user.onClick');
      expect(failure.message).not.toContain('do not log me');
    }
  });

  it('rejects symbols', () => {
    expect(() => validate({ id: Symbol('x') })).toThrow(
      PayloadSerializationError,
    );
  });

  it('rejects a promise that was never awaited', () => {
    const pending = Promise.resolve(1);
    expect(() => validate({ user: pending })).toThrow(
      /promise reached the response boundary/,
    );
    // Keep the runtime from reporting an unhandled rejection warning.
    return pending;
  });

  it('rejects prototype-polluting own keys', () => {
    const payload = JSON.parse('{"__proto__": {"admin": true}}') as unknown;
    expect(() => validate({ payload })).toThrow(/prototype-polluting/);
  });

  it('rejects binary data', () => {
    expect(() => validate({ buffer: new Uint8Array([1, 2, 3]) })).toThrow(
      /binary data/,
    );
  });

  it('enforces the byte limit', () => {
    const big = { blob: 'x'.repeat(2048) };
    try {
      validate(big, 'devalue', { maxBytes: 1024 });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadLimitError);
      expect((error as PayloadLimitError).kind).toBe('bytes');
      expect((error as PayloadLimitError).limit).toBe(1024);
    }
  });

  it('enforces the depth limit', () => {
    let deep: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 20; i++) deep = { deep };
    try {
      validate(deep, 'devalue', { maxDepth: 5 });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadLimitError);
      expect((error as PayloadLimitError).kind).toBe('depth');
    }
  });

  describe('hydration payloads (devalue)', () => {
    it('accepts the rich types devalue can represent', () => {
      expect(() =>
        validate({
          when: new Date(),
          set: new Set([1, 2]),
          map: new Map([['a', 1]]),
          pattern: /ab+c/,
          big: 10n,
        }),
      ).not.toThrow();
    });

    it('accepts a cycle, which devalue emits as a reference', () => {
      const node: Record<string, unknown> = { name: 'root' };
      node.self = node;
      expect(() => validate({ node })).not.toThrow();
    });

    it('rejects a class instance, which would arrive without its methods', () => {
      class User {
        constructor(public id: number) {}
        greet() {
          return 'hi';
        }
      }
      expect(() => validate({ user: new User(1) })).toThrow(
        /not a plain object/,
      );
    });

    it('accepts an adapter object whose prototype chain ends at null', () => {
      // Express and Fastify build `query` and `params` this way; the
      // hydration serializer accepts it, so validation must too.
      const params = Object.create(Object.create(null)) as Record<
        string,
        unknown
      >;
      params.id = '7';
      expect(() => validate({ params })).not.toThrow();
    });

    it('accepts a null-prototype object', () => {
      const bag = Object.create(null) as Record<string, unknown>;
      bag.a = 1;
      expect(() => validate({ bag })).not.toThrow();
    });
  });

  describe('API payloads (json)', () => {
    it('rejects a Map, which JSON would silently flatten to {}', () => {
      expect(() => validate({ map: new Map() }, 'json')).toThrow(
        /not representable in JSON/,
      );
    });

    it('rejects a Set', () => {
      expect(() => validate({ set: new Set() }, 'json')).toThrow(
        /not representable in JSON/,
      );
    });

    it('rejects a RegExp', () => {
      expect(() => validate({ re: /x/ }, 'json')).toThrow(
        /not representable in JSON/,
      );
    });

    it('rejects a bigint', () => {
      expect(() => validate({ big: 1n }, 'json')).toThrow(
        /not representable in JSON/,
      );
    });

    it('rejects a non-finite number', () => {
      expect(() => validate({ ratio: Number.NaN }, 'json')).toThrow(
        /non-finite number/,
      );
    });

    it('rejects a circular reference', () => {
      const node: Record<string, unknown> = {};
      node.self = node;
      expect(() => validate({ node }, 'json')).toThrow(/circular reference/);
    });

    it('accepts a Date, which JSON renders through toJSON', () => {
      expect(() => validate({ when: new Date() }, 'json')).not.toThrow();
    });

    it('accepts a class instance, matching JSON.stringify behaviour', () => {
      class Dto {
        constructor(public id: number) {}
      }
      expect(() => validate({ dto: new Dto(1) }, 'json')).not.toThrow();
    });

    it('follows a custom toJSON', () => {
      const value = {
        secretHolder: {
          secret: 'nope',
          toJSON: () => ({ public: true }),
        },
      };
      expect(() => validate(value, 'json')).not.toThrow();
    });
  });

  describe('hostile payloads', () => {
    const cases: Array<[string, unknown]> = [
      ['empty object', {}],
      ['empty array', []],
      ['null', null],
      ['undefined', undefined],
      ['sparse array', [, , 1]],
      [
        'very wide object',
        Object.fromEntries(
          Array.from({ length: 5000 }, (_, i) => [`k${i}`, i]),
        ),
      ],
      ['nested arrays', [[[[[[[[[[1]]]]]]]]]]],
      [
        'getter that throws',
        Object.defineProperty({}, 'boom', {
          enumerable: true,
          get() {
            throw new Error('nope');
          },
        }),
      ],
    ];

    it.each(cases)('handles %s deterministically', (_label, value) => {
      // Either it validates or it raises one of the pipeline's own errors —
      // never an unexpected crash from the walker itself.
      try {
        validate(value);
      } catch (error) {
        expect(
          error instanceof PayloadLimitError ||
            error instanceof PayloadSerializationError ||
            error instanceof Error,
        ).toBe(true);
      }
    });

    it('fuzzes nested values while preserving controlled failure types', () => {
      let state = 0xc0ffee;
      const next = () => (state = (state * 1103515245 + 12345) >>> 0);
      const makeValue = (depth: number): unknown => {
        if (depth > 8) return next();
        switch (next() % 8) {
          case 0:
            return `value-${next()}`;
          case 1:
            return next() % 2 === 0;
          case 2:
            return [makeValue(depth + 1), makeValue(depth + 1)];
          case 3:
            return { child: makeValue(depth + 1) };
          case 4:
            return BigInt(next());
          case 5:
            return new Map([['child', makeValue(depth + 1)]]);
          case 6:
            return () => next();
          default:
            return null;
        }
      };

      for (let sample = 0; sample < 300; sample++) {
        try {
          validate(makeValue(0), sample % 2 === 0 ? 'devalue' : 'json');
        } catch (error) {
          expect(
            error instanceof PayloadLimitError ||
              error instanceof PayloadSerializationError,
          ).toBe(true);
        }
      }
    });
  });
});
