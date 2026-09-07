import { describe, it, expect } from 'vitest';
import {
  MAX_SEGMENT_BYTES,
  SEGMENT_SCHEMA_VERSION,
  validateSegmentResponse,
} from '../segment-schema';

function validSegment(overrides: Record<string, unknown> = {}) {
  return {
    v: SEGMENT_SCHEMA_VERSION,
    html: '<div>page</div>',
    props: { title: 'Page' },
    swapTarget: 'RootLayout',
    componentName: 'HomePage',
    context: { url: '/', path: '/', query: {}, params: {}, method: 'GET' },
    layouts: [{ name: 'InnerLayout', props: { open: true } }],
    ...overrides,
  };
}

describe('validateSegmentResponse', () => {
  it('accepts a well-formed segment', () => {
    const result = validateSegmentResponse(validSegment(), {
      availableTargets: ['RootLayout'],
    });
    expect(result.ok).toBe(true);
  });

  it('accepts a response with no version, for a server mid-upgrade', () => {
    const { v: _version, ...withoutVersion } = validSegment();
    const result = validateSegmentResponse(withoutVersion);
    expect(result.ok).toBe(true);
  });

  it('rejects a version it does not understand', () => {
    const result = validateSegmentResponse(validSegment({ v: 99 }));
    expect(result).toMatchObject({ ok: false, reason: 'unsupported-version' });
  });

  it('accepts the full-navigation signal', () => {
    const result = validateSegmentResponse({
      v: SEGMENT_SCHEMA_VERSION,
      swapTarget: null,
    });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.value.swapTarget).toBeNull();
  });

  it('rejects a swap target that is not in the current layout tree', () => {
    const result = validateSegmentResponse(
      validSegment({ swapTarget: 'GhostLayout' }),
      { availableTargets: ['RootLayout'] },
    );
    expect(result).toMatchObject({ ok: false, reason: 'unknown-target' });
  });

  it('rejects a swap target that is not a component name', () => {
    const result = validateSegmentResponse(
      validSegment({ swapTarget: '"><img src=x onerror=alert(1)>' }),
    );
    expect(result).toMatchObject({ ok: false, reason: 'malformed' });
  });

  it('rejects an oversized body', () => {
    const result = validateSegmentResponse(validSegment(), {
      byteLength: MAX_SEGMENT_BYTES + 1,
    });
    expect(result).toMatchObject({ ok: false, reason: 'too-large' });
  });

  it('rejects oversized html even when the body length is unknown', () => {
    const result = validateSegmentResponse(
      validSegment({ html: 'x'.repeat(MAX_SEGMENT_BYTES + 1) }),
    );
    expect(result).toMatchObject({ ok: false, reason: 'too-large' });
  });

  it.each([
    ['a non-object', 'nope'],
    ['an array', []],
    ['missing html', validSegment({ html: undefined })],
    ['non-string html', validSegment({ html: 42 })],
    ['a bad component name', validSegment({ componentName: 'a b' })],
    ['missing props', validSegment({ props: undefined })],
    ['non-object props', validSegment({ props: [1, 2] })],
    ['non-object head', validSegment({ head: 'title' })],
    ['non-object context', validSegment({ context: 'ctx' })],
    ['non-array layouts', validSegment({ layouts: {} })],
    ['a layout without a name', validSegment({ layouts: [{ props: {} }] })],
    ['a layout with a bad name', validSegment({ layouts: [{ name: '../x' }] })],
  ])('rejects %s', (_label, payload) => {
    const result = validateSegmentResponse(payload);
    expect(result.ok).toBe(false);
  });

  it('strips unknown properties from the validated value', () => {
    const result = validateSegmentResponse(
      validSegment({ extra: 'not part of the schema' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toHaveProperty('extra');
    }
  });

  it('defaults missing layouts to an empty list', () => {
    const result = validateSegmentResponse(
      validSegment({ layouts: undefined }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.layouts).toEqual([]);
  });
});
