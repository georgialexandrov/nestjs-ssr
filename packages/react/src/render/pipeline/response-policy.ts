import type { ResolvedRepresentationPolicy } from '../../interfaces/representation-policy.interface';
import type { RepresentationKind } from './negotiator';
import {
  appendVary,
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
  if (!policy.emitResponseHeaders) return;

  for (const field of policy.cache.keys) {
    appendVary(response, field);
  }

  setResponseHeaderIfAbsent(
    response,
    'Cache-Control',
    buildCacheControl(policy.cache),
  );

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
