/**
 * The single place where server-rendered segment HTML is written to the DOM.
 *
 * Every other navigation path goes through here, so a Content-Security-Policy
 * with Trusted Types has exactly one sink to allow, and any future change to
 * how fragments are applied has exactly one place to change.
 *
 * The policy vouches for markup this library received from its own server; it
 * does not sanitize. Application-authored raw HTML (`dangerouslySetInnerHTML`)
 * still needs an application-side sanitizer.
 */

/** Name of the Trusted Types policy this adapter creates. */
export const TRUSTED_TYPES_POLICY_NAME = 'nestjs-ssr-segment';

interface TrustedTypePolicy {
  createHTML(input: string): unknown;
}

interface TrustedTypePolicyFactory {
  createPolicy(
    name: string,
    rules: { createHTML: (input: string) => string },
  ): TrustedTypePolicy;
}

let policy: TrustedTypePolicy | null | undefined;

function getPolicy(): TrustedTypePolicy | null {
  if (policy !== undefined) return policy;

  const factory = (globalThis as { trustedTypes?: TrustedTypePolicyFactory })
    .trustedTypes;

  if (!factory || typeof factory.createPolicy !== 'function') {
    policy = null;
    return policy;
  }

  try {
    policy = factory.createPolicy(TRUSTED_TYPES_POLICY_NAME, {
      // Identity: the markup already came from this application's server.
      createHTML: (input: string) => input,
    });
  } catch (error) {
    // A CSP that does not allow this policy name, or a duplicate creation
    // after a hot reload. Fall back to the untrusted path; the browser will
    // block the assignment if it enforces Trusted Types, which is the
    // correct outcome.
    console.warn(
      `[navigation] Could not create the "${TRUSTED_TYPES_POLICY_NAME}" Trusted Types policy. ` +
        'Add it to trusted-types in your Content-Security-Policy to enable client-side navigation.',
      error,
    );
    policy = null;
  }

  return policy;
}

/** Test seam: drop the cached policy so a fresh one is created. */
export function resetTrustedTypesPolicy(): void {
  policy = undefined;
}

/**
 * Convert server HTML into a value the DOM will accept.
 * Returns the raw string when Trusted Types is not enforced.
 */
export function createTrustedSegmentHtml(html: string): unknown {
  const trustedTypes = getPolicy();
  return trustedTypes ? trustedTypes.createHTML(html) : html;
}

/** Replace an element's children with server-rendered segment markup. */
export function writeSegmentHtml(target: Element, html: string): void {
  // `innerHTML` accepts a TrustedHTML at runtime; the DOM lib types it as string.
  (target as { innerHTML: unknown }).innerHTML = createTrustedSegmentHtml(html);
}

/** Empty an element without going through an HTML sink. */
export function clearElement(target: Element): void {
  target.replaceChildren();
}
