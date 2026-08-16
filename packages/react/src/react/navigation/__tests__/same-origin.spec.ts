import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isSameOrigin, resolveSameOriginUrl } from '../same-origin';
import { navigate } from '../navigate';

describe('resolveSameOriginUrl', () => {
  it('accepts relative paths', () => {
    expect(isSameOrigin('/recipes')).toBe(true);
    expect(isSameOrigin('recipes/carbonara')).toBe(true);
    expect(isSameOrigin('/recipes?category=Soups#top')).toBe(true);
  });

  it('accepts absolute URLs on the current origin', () => {
    const here = window.location.origin;
    expect(isSameOrigin(`${here}/recipes`)).toBe(true);
  });

  it('rejects other origins', () => {
    expect(isSameOrigin('https://evil.test/x')).toBe(false);
    expect(isSameOrigin('http://evil.test/x')).toBe(false);
  });

  it('rejects protocol-relative URLs, which resolve to another host', () => {
    // "//evil.test/x" keeps the current scheme but swaps the host — the
    // classic way an origin check that only looks at the leading "/" is
    // bypassed.
    expect(isSameOrigin('//evil.test/x')).toBe(false);
  });

  it('rejects opaque and non-fetchable schemes', () => {
    expect(isSameOrigin('javascript:alert(1)')).toBe(false);
    expect(isSameOrigin('data:text/html,<script>alert(1)</script>')).toBe(
      false,
    );
    expect(isSameOrigin('blob:http://localhost/abc')).toBe(false);
  });

  it('returns the resolved URL so callers need not re-parse', () => {
    const resolved = resolveSameOriginUrl('/recipes?x=1');
    expect(resolved?.pathname).toBe('/recipes');
    expect(resolved?.search).toBe('?x=1');
    expect(resolved?.origin).toBe(window.location.origin);
  });
});

describe('navigate origin guard', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    errorSpy.mockRestore();
  });

  it('refuses a cross-origin target without fetching it', async () => {
    // The segment response is written into the DOM via innerHTML, so a
    // cross-origin server answering with permissive CORS would otherwise get
    // to inject markup into this origin.
    await navigate('https://evil.test/segment');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Refusing to navigate'),
    );
  });

  it('refuses a javascript: target', async () => {
    await navigate('javascript:alert(1)');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('refuses a protocol-relative target', async () => {
    await navigate('//evil.test/segment');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('does not redirect the browser when refusing', async () => {
    // Falling back to window.location for a rejected URL would turn the
    // guard into an open redirect instead of a fix.
    const before = window.location.href;
    await navigate('https://evil.test/segment');
    expect(window.location.href).toBe(before);
  });
});
