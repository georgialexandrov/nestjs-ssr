import type { ResolvedRepresentationPolicy } from '../../interfaces/representation-policy.interface';
import type { RepresentationKind } from './negotiator';
import {
  appendVary,
  disableEtagForResponse,
  getResponseHeader,
  setResponseHeaderIfAbsent,
  type WritableResponse,
} from './response-writer';

/** Everything the writer needs to stamp policy onto one response. */
export interface ResponsePolicyInput {
  policy: ResolvedRepresentationPolicy;
  /** Header fields negotiation depended on. */
  vary: string[];
  kind: RepresentationKind;
  /** Per-request CSP nonce, when the application provides one. */
  nonce?: string;
}

/**
 * Build the `Cache-Control` value for a rendered response.
 *
 * The default is `private, no-store`: a rendered page is assembled from
 * session-scoped context and page props, so storing it anywhere is opt-in.
 */
export function buildCacheControl(
  cache: ResolvedRepresentationPolicy['cache'],
): string {
  const directives: string[] = [cache.visibility];

  if (cache.noStore) {
    directives.push('no-store');
    // `must-revalidate` adds nothing once storage is refused.
    return directives.join(', ');
  }

  if (cache.maxAge !== undefined) directives.push(`max-age=${cache.maxAge}`);
  if (cache.sMaxAge !== undefined) directives.push(`s-maxage=${cache.sMaxAge}`);
  if (cache.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${cache.staleWhileRevalidate}`);
  }
  if (cache.maxAge === undefined && cache.sMaxAge === undefined) {
    directives.push('no-cache');
  }

  return directives.join(', ');
}

/**
 * Disable ETag generation for this response, but only when the
 * `Cache-Control` header actually present on it (this library's own, or the
 * application's) contains `no-store` — never off the resolved policy alone.
 */
function suppressEtagIfNoStore(response: WritableResponse): void {
  const cacheControl = getResponseHeader(response, 'Cache-Control');
  if (cacheControl?.toLowerCase().includes('no-store')) {
    disableEtagForResponse(response);
  }
}

/**
 * Apply cache, negotiation, and security headers to a response.
 *
 * Composes with the host application: `Vary` is appended to, and every
 * security header is only set when the application has not set it already.
 */
export function applyResponsePolicy(
  response: WritableResponse,
  input: ResponsePolicyInput,
): void {
  const { policy, vary, kind, nonce } = input;

  // Negotiation metadata is not optional: these are the request headers that
  // select the representation, and a shared cache that ignores them serves
  // the wrong one. This is also what the library has always sent.
  for (const field of vary) {
    appendVary(response, field);
  }

  // Everything below is a header this library did not previously send.
  // Adding them unasked would change every response of every app on upgrade,
  // so the stage stays dormant until a cache or security policy is declared.
  if (!policy.emitResponseHeaders) {
    // Dormant mode never writes Cache-Control itself, but the app may have
    // set its own before rendering — honor a no-store the app declared, and
    // leave the ETag alone for anything else (including a cacheable value
    // the app set, which still needs its ETag for 304s).
    suppressEtagIfNoStore(response);
    return;
  }

  for (const field of policy.cache.keys) {
    appendVary(response, field);
  }

  setResponseHeaderIfAbsent(
    response,
    'Cache-Control',
    buildCacheControl(policy.cache),
  );

  // A `no-store` response is never compliant to cache or revalidate, so the
  // `ETag` Express would otherwise compute for it (~5% CPU, profiled) can
  // never be used. Gate on the `Cache-Control` header actually set on the
  // response (this library's own default, or the app's own if it set one
  // first — `setResponseHeaderIfAbsent` won't have overwritten it) rather
  // than on the resolved policy alone.
  suppressEtagIfNoStore(response);

  const security = policy.securityHeaders;

  if (security.nosniff) {
    setResponseHeaderIfAbsent(response, 'X-Content-Type-Options', 'nosniff');
  }

  if (security.referrerPolicy) {
    setResponseHeaderIfAbsent(
      response,
      'Referrer-Policy',
      security.referrerPolicy,
    );
  }

  // A CSP only makes sense on the document response, and a nonce-based policy
  // is meaningless without the nonce the library stamps onto its scripts.
  if (security.contentSecurityPolicy && kind === 'html') {
    const value = security.contentSecurityPolicy.replace(
      /\{nonce\}/g,
      nonce ?? '',
    );
    if (!security.contentSecurityPolicy.includes('{nonce}') || nonce) {
      setResponseHeaderIfAbsent(response, 'Content-Security-Policy', value);
    }
  }
}
