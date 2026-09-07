import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TRUSTED_TYPES_POLICY_NAME,
  clearElement,
  createTrustedSegmentHtml,
  resetTrustedTypesPolicy,
  writeSegmentHtml,
} from '../dom-update-adapter';

declare global {
  // eslint-disable-next-line no-var
  var trustedTypes: unknown;
}

beforeEach(() => {
  resetTrustedTypesPolicy();
});

afterEach(() => {
  delete (globalThis as { trustedTypes?: unknown }).trustedTypes;
  resetTrustedTypesPolicy();
  vi.restoreAllMocks();
});

describe('without Trusted Types', () => {
  it('writes the markup straight through', () => {
    const outlet = document.createElement('div');
    writeSegmentHtml(outlet, '<p>hello</p>');
    expect(outlet.innerHTML).toBe('<p>hello</p>');
  });

  it('returns the raw string from createTrustedSegmentHtml', () => {
    expect(createTrustedSegmentHtml('<p>x</p>')).toBe('<p>x</p>');
  });
});

describe('with Trusted Types enforced', () => {
  it('creates one named policy and routes markup through it', () => {
    const createHTML = vi.fn((input: string) => `trusted:${input}`);
    const createPolicy = vi.fn(() => ({ createHTML }));
    (globalThis as { trustedTypes?: unknown }).trustedTypes = { createPolicy };

    const outlet = document.createElement('div');
    writeSegmentHtml(outlet, '<p>a</p>');
    writeSegmentHtml(outlet, '<p>b</p>');

    expect(createPolicy).toHaveBeenCalledOnce();
    expect(createPolicy.mock.calls[0][0]).toBe(TRUSTED_TYPES_POLICY_NAME);
    expect(createHTML).toHaveBeenCalledTimes(2);
  });

  it('passes the markup through unchanged', () => {
    (globalThis as { trustedTypes?: unknown }).trustedTypes = {
      createPolicy: (
        _name: string,
        rules: { createHTML: (input: string) => string },
      ) => ({ createHTML: rules.createHTML }),
    };

    expect(createTrustedSegmentHtml('<p>x</p>')).toBe('<p>x</p>');
  });

  it('falls back when the CSP refuses the policy name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (globalThis as { trustedTypes?: unknown }).trustedTypes = {
      createPolicy: () => {
        throw new Error('policy not allowed');
      },
    };

    const outlet = document.createElement('div');
    writeSegmentHtml(outlet, '<p>fallback</p>');

    expect(outlet.innerHTML).toBe('<p>fallback</p>');
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('clearElement', () => {
  it('empties an element without touching an HTML sink', () => {
    const outlet = document.createElement('div');
    outlet.appendChild(document.createElement('span'));
    clearElement(outlet);
    expect(outlet.childNodes.length).toBe(0);
  });
});
