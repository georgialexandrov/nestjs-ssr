/**
 * Representation policy — which representations a rendered route offers, and
 * the limits, deadline, cache stance, and security headers applied to them.
 *
 * Declared at module level and tightened per route via
 * `@Render(Component, { representation: { ... } })`.
 */

/** Cache stance for a rendered response. */
export interface CachePolicy {
  /**
   * `private` keeps a rendered response out of shared caches. `public` must be
   * declared explicitly — a rendered page usually contains per-user state, so
   * caching it is opt-in.
   *
   * No `Cache-Control` is sent at all unless this policy is configured.
   */
  visibility?: 'private' | 'public';

  /**
   * Skip storage entirely. Defaults to `true` for `private` responses, which
   * is the conservative stance for anything rendered from session data.
   */
  noStore?: boolean;

  /** `max-age` in seconds. Only meaningful when `noStore` is false. */
  maxAge?: number;

  /** `s-maxage` in seconds, for shared caches. */
  sMaxAge?: number;

  /** `stale-while-revalidate` in seconds. */
  staleWhileRevalidate?: number;

  /**
   * Extra request headers this response varies on. Combined with the headers
   * negotiation itself depends on (`Accept`, `X-Current-Layouts`).
   */
  keys?: string[];
}

/** Security response headers the library contributes. */
export interface SecurityHeadersPolicy {
  /**
   * Send `X-Content-Type-Options: nosniff`.
   * @default true
   */
  nosniff?: boolean;

  /**
   * Value for `Referrer-Policy`, or `false` to send none.
   * @default 'strict-origin-when-cross-origin'
   */
  referrerPolicy?: string | false;

  /**
   * Content-Security-Policy applied to rendered HTML. `{nonce}` is replaced
   * with the per-request nonce from the `cspNonce` factory. Ignored when no
   * nonce factory is configured, and never applied over a CSP header the
   * host application already set.
   */
  contentSecurityPolicy?: string | false;
}

/** Serialization limits for client-visible payloads. */
export interface PayloadLimits {
  /**
   * What to do when a payload breaks a rule or a limit.
   *
   * `warn` (the default) logs the offending property path and serializes
   * anyway, so adopting this release cannot turn a page that renders today
   * into a 500. `enforce` refuses the payload before response headers are
   * committed. Run on `warn` long enough to see whether anything real trips
   * it, then switch.
   *
   * @default 'warn'
   */
  mode?: 'warn' | 'enforce';

  /**
   * Maximum serialized size, in bytes, of a client-visible payload.
   * @default 2097152 (2 MiB)
   */
  maxBytes?: number;

  /**
   * Maximum nesting depth of a client-visible payload.
   * @default 64
   */
  maxDepth?: number;
}

/** Module policy fields that routes are forbidden from overriding. */
export type MandatoryRepresentationPolicyField =
  | 'html'
  | 'json'
  | 'default'
  | 'limits'
  | 'deadlineMs'
  | 'cache'
  | 'securityHeaders';

/**
 * Module- or route-level representation policy.
 *
 * Route policy overrides module policy field by field; limits may only be
 * tightened, never raised.
 */
export interface RepresentationPolicy {
  /**
   * Offer an HTML representation.
   * @default true
   */
  html?: boolean;

  /**
   * Offer a JSON representation. This is the policy equivalent of `jsonApi`.
   * @default false
   */
  json?: boolean;

  /**
   * Representation served when the request expresses no preference.
   * @default 'html'
   */
  default?: 'html' | 'json';

  /** Serialization limits for this scope. */
  limits?: PayloadLimits;

  /**
   * Render deadline in milliseconds. Falls back to the module `timeout`.
   */
  deadlineMs?: number;

  /**
   * Cache stance for rendered responses.
   *
   * Opt-in: with no cache policy configured anywhere, the library sends no
   * `Cache-Control` at all, exactly as it always has.
   */
  cache?: CachePolicy;

  /**
   * Security headers contributed to rendered responses.
   *
   * Opt-in for the same reason as `cache` — configuring either one turns on
   * the response-policy stage for that scope.
   */
  securityHeaders?: SecurityHeadersPolicy;

  /**
   * Module-only governance: listed fields cannot be overridden per route.
   * Use this for cache, security headers, or other host-wide requirements.
   */
  mandatory?: MandatoryRepresentationPolicyField[];
}

/** A fully resolved policy — every field decided, nothing optional. */
export interface ResolvedRepresentationPolicy {
  html: boolean;
  json: boolean;
  default: 'html' | 'json';
  limits: Required<PayloadLimits>;
  deadlineMs: number;
  cache: Required<
    Omit<CachePolicy, 'maxAge' | 'sMaxAge' | 'staleWhileRevalidate'>
  > &
    Pick<CachePolicy, 'maxAge' | 'sMaxAge' | 'staleWhileRevalidate'>;
  securityHeaders: Required<SecurityHeadersPolicy>;
  mandatory: MandatoryRepresentationPolicyField[];
  /**
   * Whether the application asked for response-policy headers at all. When it
   * did not, the writer emits none of them and a rendered response carries
   * exactly the headers this library has always sent.
   */
  emitResponseHeaders: boolean;
}
