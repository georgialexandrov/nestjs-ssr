import { describe, it, expect } from 'vitest';
import { applyResponsePolicy, buildCacheControl } from '../response-policy';
import { defaultResolvedPolicy } from '../representation-policy';
import type { ResolvedRepresentationPolicy } from '../../../interfaces/representation-policy.interface';

/**
 * The stage is dormant unless an application configured a cache or security
 * policy, so every test below that exercises a header has to opt in — which
 * is itself the guarantee that an unconfigured app gets none of them.
 */
function configured(
  overrides: Partial<ResolvedRepresentationPolicy> = {},
): ResolvedRepresentationPolicy {
  return {
    ...defaultResolvedPolicy(),
    emitResponseHeaders: true,
    ...overrides,
  };
}
import type { WritableResponse } from '../response-writer';

function makeResponse(initial: Record<string, string> = {}) {
  const headers = new Map<string, string>(
    Object.entries(initial).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const response = {
    raw: {
      getHeader: (name: string) => headers.get(name.toLowerCase()),
      setHeader: (name: string, value: string) => {
        headers.set(name.toLowerCase(), value);
      },
    },
    header: (name: string, value: string) => {
      headers.set(name.toLowerCase(), value);
    },
  } as unknown as WritableResponse;
  return { response, headers };
}

describe('buildCacheControl', () => {
  it('defaults to private and non-storable', () => {
    expect(buildCacheControl(defaultResolvedPolicy().cache)).toBe(
      'private, no-store',
    );
  });

  it('emits a public lifetime when one is declared', () => {
    expect(
      buildCacheControl({
        visibility: 'public',
        noStore: false,
        keys: [],
        maxAge: 60,
        sMaxAge: 120,
        staleWhileRevalidate: 30,
      }),
    ).toBe('public, max-age=60, s-maxage=120, stale-while-revalidate=30');
  });

  it('falls back to no-cache when storage is allowed without a lifetime', () => {
    expect(
      buildCacheControl({ visibility: 'private', noStore: false, keys: [] }),
    ).toBe('private, no-cache');
  });
});

describe('applyResponsePolicy', () => {
  it('emits only negotiation metadata when no policy is configured', () => {
    const { response, headers } = makeResponse();
    applyResponsePolicy(response, {
      policy: defaultResolvedPolicy(),
      vary: ['Accept', 'X-Current-Layouts'],
      kind: 'html',
    });

    expect(headers.get('vary')).toBe('Accept, X-Current-Layouts');
    expect(headers.get('cache-control')).toBeUndefined();
    expect(headers.get('x-content-type-options')).toBeUndefined();
    expect(headers.get('referrer-policy')).toBeUndefined();
  });

  it('applies conservative defaults once a policy is configured', () => {
    const { response, headers } = makeResponse();
    applyResponsePolicy(response, {
      policy: configured(),
      vary: ['Accept', 'X-Current-Layouts'],
      kind: 'html',
    });

    expect(headers.get('vary')).toBe('Accept, X-Current-Layouts');
    expect(headers.get('cache-control')).toBe('private, no-store');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('referrer-policy')).toBe(
      'strict-origin-when-cross-origin',
    );
  });

  it('combines declared cache keys with negotiation fields in Vary', () => {
    const base = configured();
    const { response, headers } = makeResponse();
    applyResponsePolicy(response, {
      policy: {
        ...base,
        cache: {
          visibility: 'public',
          noStore: false,
          keys: ['Accept-Language'],
          maxAge: 60,
        },
      },
      vary: ['Accept'],
      kind: 'html',
    });

    expect(headers.get('vary')).toBe('Accept, Accept-Language');
    expect(headers.get('cache-control')).toBe('public, max-age=60');
  });

  it('preserves a Content-Security-Policy the host already set', () => {
    const base = configured();
    const { response, headers } = makeResponse({
      'Content-Security-Policy': "default-src 'none'",
    });

    applyResponsePolicy(response, {
      policy: {
        ...base,
        securityHeaders: {
          ...base.securityHeaders,
          contentSecurityPolicy: "script-src 'nonce-{nonce}'",
        },
      },
      vary: ['Accept'],
      kind: 'html',
      nonce: 'abc123',
    });

    expect(headers.get('content-security-policy')).toBe("default-src 'none'");
    // Non-conflicting headers are still applied.
    expect(headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('substitutes the request nonce into the configured CSP', () => {
    const base = configured();
    const { response, headers } = makeResponse();

    applyResponsePolicy(response, {
      policy: {
        ...base,
        securityHeaders: {
          ...base.securityHeaders,
          contentSecurityPolicy: "script-src 'nonce-{nonce}'",
        },
      },
      vary: ['Accept'],
      kind: 'html',
      nonce: 'abc123',
    });

    expect(headers.get('content-security-policy')).toBe(
      "script-src 'nonce-abc123'",
    );
  });

  it('does not emit a nonce-based CSP when no nonce is available', () => {
    const base = configured();
    const { response, headers } = makeResponse();

    applyResponsePolicy(response, {
      policy: {
        ...base,
        securityHeaders: {
          ...base.securityHeaders,
          contentSecurityPolicy: "script-src 'nonce-{nonce}'",
        },
      },
      vary: ['Accept'],
      kind: 'html',
    });

    expect(headers.get('content-security-policy')).toBeUndefined();
  });

  it('does not put a document CSP on a JSON response', () => {
    const base = configured();
    const { response, headers } = makeResponse();

    applyResponsePolicy(response, {
      policy: {
        ...base,
        securityHeaders: {
          ...base.securityHeaders,
          contentSecurityPolicy: "default-src 'self'",
        },
      },
      vary: ['Accept'],
      kind: 'json',
    });

    expect(headers.get('content-security-policy')).toBeUndefined();
  });

  it('can be told to send no referrer policy at all', () => {
    const base = configured();
    const { response, headers } = makeResponse();

    applyResponsePolicy(response, {
      policy: {
        ...base,
        securityHeaders: { ...base.securityHeaders, referrerPolicy: false },
      },
      vary: ['Accept'],
      kind: 'html',
    });

    expect(headers.get('referrer-policy')).toBeUndefined();
  });
});
