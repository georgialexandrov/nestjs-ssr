/**
 * Same-origin validation for client-side navigation targets.
 *
 * Both entry points into the navigation system have to agree on this: `Link`
 * decides whether to intercept a click, and `navigate()` decides whether to
 * fetch a segment. `navigate()` is the security-critical one — it parses the
 * response as JSON and writes `response.html` into the DOM via `innerHTML`, so
 * a cross-origin target with permissive CORS would let a third-party server
 * inject markup into this origin. The check lives here so the two call sites
 * cannot drift apart again.
 */

/**
 * Resolve `url` against the current document and return it only if it is a
 * same-origin http(s) URL. Returns null otherwise — including for malformed
 * URLs and for non-fetchable schemes such as `javascript:`, `data:` and
 * `blob:`, whose origin is opaque.
 */
export function resolveSameOriginUrl(url: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(url, window.location.href);
  } catch {
    return null;
  }

  // Opaque-origin and non-navigable schemes never round-trip through
  // origin comparison meaningfully, so reject them by protocol first.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  return parsed.origin === window.location.origin ? parsed : null;
}

/**
 * Whether a URL is safe for client-side navigation from the current page.
 */
export function isSameOrigin(url: string): boolean {
  return resolveSameOriginUrl(url) !== null;
}
