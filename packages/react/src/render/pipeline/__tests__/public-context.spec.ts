import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DENIED_HEADERS,
  buildPublicContext,
  collectPublicCookies,
  collectPublicHeaders,
  resetPublicContextDiagnostics,
} from '../public-context';
import type { SSRRequest } from '../../../interfaces/http-adapters.interface';

function makeRequest(overrides: Partial<SSRRequest> = {}): SSRRequest {
  return {
    url: '/users/7?tab=profile',
    path: '/users/7',
    method: 'GET',
    query: { tab: 'profile' },
    params: { id: '7' },
    headers: {
      'accept-language': 'en-GB,en;q=0.9',
      'user-agent': 'test-agent',
      authorization: 'Bearer super-secret-token',
      cookie: 'session=secret',
      'x-tenant-id': 'acme',
    },
    cookies: { theme: 'dark', session: 'secret' },
    ...overrides,
  } as SSRRequest;
}

beforeEach(() => {
  resetPublicContextDiagnostics();
});

describe('collectPublicHeaders', () => {
  it('exposes allowed headers under their canonical lowercase name', () => {
    const headers = collectPublicHeaders(makeRequest(), [
      'Accept-Language',
      'X-Tenant-Id',
    ]);
    expect(headers).toEqual({
      'accept-language': 'en-GB,en;q=0.9',
      'x-tenant-id': 'acme',
    });
  });

  it('refuses credential headers even when they are allowlisted', () => {
    const warn = vi.fn();
    const headers = collectPublicHeaders(
      makeRequest(),
      ['authorization', 'cookie', 'accept-language'],
      { warn },
    );

    expect(headers).toEqual({ 'accept-language': 'en-GB,en;q=0.9' });
    expect(warn).toHaveBeenCalledTimes(2);
    for (const call of warn.mock.calls) {
      // The diagnostic names the header, never its value.
      expect(String(call[0])).not.toContain('super-secret-token');
    }
  });

  it('denies every credential header in the denylist', () => {
    const request = makeRequest({
      headers: Object.fromEntries(
        [...DENIED_HEADERS].map((name) => [name, 'secret']),
      ),
    });
    expect(collectPublicHeaders(request, [...DENIED_HEADERS])).toEqual({});
  });

  it('joins a repeated header into one string', () => {
    const request = makeRequest({
      headers: { 'x-forwarded-for': ['a', 'b'] },
    });
    expect(collectPublicHeaders(request, ['x-forwarded-for'])).toEqual({
      'x-forwarded-for': 'a, b',
    });
  });

  it('omits headers that are absent', () => {
    expect(collectPublicHeaders(makeRequest(), ['x-missing'])).toEqual({});
  });
});

describe('collectPublicCookies', () => {
  it('exposes only allowed cookies', () => {
    expect(collectPublicCookies(makeRequest(), ['theme'])).toEqual({
      theme: 'dark',
    });
  });

  it('is empty when no cookie parser populated the request', () => {
    expect(collectPublicCookies({ cookies: undefined }, ['theme'])).toEqual({});
  });

  it('ignores non-string cookie values', () => {
    expect(
      collectPublicCookies({ cookies: { theme: { nested: true } } }, ['theme']),
    ).toEqual({});
  });
});

describe('buildPublicContext', () => {
  it('keeps the default context byte-compatible by omitting empty bags', () => {
    const context = buildPublicContext(makeRequest());
    expect(context.headers).toBeUndefined();
    expect(context.cookies).toBeUndefined();
  });

  it('keeps a header named like a base context key inside the bag', () => {
    const request = makeRequest({
      headers: { url: 'https://evil.test', path: '/evil', method: 'DELETE' },
    });

    const context = buildPublicContext(request, {
      allowedHeaders: ['url', 'path', 'method'],
    });

    expect(context.headers).toEqual({
      url: 'https://evil.test',
      path: '/evil',
      method: 'DELETE',
    });
    expect(context.url).toBe('/users/7?tab=profile');
    expect(context.path).toBe('/users/7');
    expect(context.method).toBe('GET');
  });

  it('preserves allowed headers at the top level and in the nested bag', () => {
    const context = buildPublicContext(makeRequest(), {
      allowedHeaders: ['x-tenant-id'],
    });

    expect((context as Record<string, unknown>)['x-tenant-id']).toBe('acme');
    expect(context.headers?.['x-tenant-id']).toBe('acme');
  });

  it('preserves the configured casing of a legacy top-level alias', () => {
    const context = buildPublicContext(makeRequest(), {
      allowedHeaders: ['X-Tenant-ID'],
    });

    expect((context as Record<string, unknown>)['X-Tenant-ID']).toBe('acme');
    expect(context.headers?.['x-tenant-id']).toBe('acme');
  });

  it('derives the path from the URL when the adapter has none', () => {
    const context = buildPublicContext(
      makeRequest({ path: undefined, url: '/dashboard?tab=1' }),
    );
    expect(context.path).toBe('/dashboard');
  });

  it('warns about an unsafe allowlist only once per process', () => {
    const logger = { warn: vi.fn() };
    buildPublicContext(makeRequest(), {
      allowedHeaders: ['authorization'],
      logger,
    });
    buildPublicContext(makeRequest(), {
      allowedHeaders: ['authorization'],
      logger,
    });
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('fuzzes hostile allowlists without exposing credentials or base fields', () => {
    let state = 0xa110ca7e;
    const next = () => (state = (state * 1664525 + 1013904223) >>> 0);
    const names = [
      ...DENIED_HEADERS,
      'url',
      'path',
      'method',
      'x-tenant-id',
      '__proto__',
      '',
    ];

    for (let sample = 0; sample < 300; sample++) {
      const allowedHeaders = Array.from(
        { length: next() % 12 },
        () => names[next() % names.length],
      );
      const context = buildPublicContext(makeRequest(), { allowedHeaders });

      expect(context.url).toBe('/users/7?tab=profile');
      expect(context.path).toBe('/users/7');
      expect(context.method).toBe('GET');
      for (const denied of DENIED_HEADERS) {
        expect(context.headers?.[denied]).toBeUndefined();
      }
    }
  });
});
