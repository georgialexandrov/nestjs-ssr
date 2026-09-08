import { describe, expect, it } from 'vitest';
import { PublicPayloadProjector } from '../public-payload';

const limits = {
  mode: 'enforce' as const,
  maxBytes: 1024 * 1024,
  maxDepth: 32,
};

describe('PublicPayloadProjector ownership boundary', () => {
  it('freezes a detached page graph without freezing controller-owned data', () => {
    const child = { name: 'Ada' };
    const props = { user: child };
    const projected = new PublicPayloadProjector().projectPageData(
      props,
      limits,
    );

    expect(projected).not.toBe(props);
    expect(projected.user).not.toBe(child);
    expect(Object.isFrozen(projected)).toBe(true);
    expect(Object.isFrozen(projected.user)).toBe(true);
    expect(Object.isFrozen(props)).toBe(false);
    expect(Object.isFrozen(child)).toBe(false);
  });

  it('detaches cycles and supported hydration types', () => {
    const original: Record<string, unknown> = {
      date: new Date('2026-01-01T00:00:00.000Z'),
      map: new Map([['role', { name: 'admin' }]]),
      set: new Set([{ id: 1 }]),
    };
    original.self = original;

    const projected = new PublicPayloadProjector().projectPageData(
      original,
      limits,
    );

    expect(projected).not.toBe(original);
    expect(projected.self).toBe(projected);
    expect(projected.date).not.toBe(original.date);
    expect(projected.map).not.toBe(original.map);
    expect(projected.set).not.toBe(original.set);
    expect((projected.map as Map<string, unknown>).get('role')).not.toBe(
      (original.map as Map<string, unknown>).get('role'),
    );
    expect(() =>
      (projected.map as Map<string, unknown>).set('new', true),
    ).toThrow(/Cannot mutate/);
    expect(() => (projected.set as Set<unknown>).add('new')).toThrow(
      /Cannot mutate/,
    );
  });

  it('validates the exact detached value when an accessor changes', () => {
    let reads = 0;
    const props = {} as Record<string, unknown>;
    Object.defineProperty(props, 'value', {
      enumerable: true,
      get: () => (++reads === 1 ? 'safe' : () => 'unsafe'),
    });

    const projected = new PublicPayloadProjector().projectPageData(
      props,
      limits,
    );

    expect(projected.value).toBe('safe');
    expect(reads).toBe(1);
  });

  it('does not freeze an invalid legacy value allowed through warn mode', () => {
    const props = { callback: () => 'legacy' };
    const projected = new PublicPayloadProjector().projectPageData(props, {
      ...limits,
      mode: 'warn',
    });

    expect(projected).toBe(props);
    expect(Object.isFrozen(props)).toBe(false);
  });
});
