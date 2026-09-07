import { Logger } from '@nestjs/common';
import type { RenderContext } from '../../interfaces/render-context.interface';
import type { SSRRequest } from '../../interfaces/http-adapters.interface';

/**
 * Header names that carry credentials and are never exposed to the client,
 * even when an application lists them in `allowedHeaders`.
 *
 * The allowlist is application configuration and can be wrong — a copied
 * snippet, a wildcard expansion, a header added to debug an auth problem and
 * left in. This list is the backstop that keeps such a mistake from shipping
 * a bearer token into the hydration payload.
 */
export const DENIED_HEADERS: ReadonlySet<string> = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'www-authenticate',
  'proxy-authenticate',
  'authentication-info',
  'x-api-key',
  'x-auth-token',
  'x-access-token',
  'x-csrf-token',
  'x-xsrf-token',
]);

/**
 * Base context keys an allowed header or cookie must never overwrite.
 * A header literally named `url` stays in `context.headers.url`.
 */
export const RESERVED_CONTEXT_KEYS: ReadonlySet<string> = new Set([
  'url',
  'path',
  'query',
  'params',
  'method',
  'headers',
  'cookies',
]);

export interface PublicContextOptions {
  allowedHeaders?: string[];
  allowedCookies?: string[];
  /**
   * Also expose allowed headers as top-level context properties.
   * Deprecated: names can collide with base context and application keys.
   * @default true during the compatibility release
   */
  legacyHeaderAliases?: boolean;
  /** Reports unsafe configuration once per process. Always active. */
  logger?: Pick<Logger, 'warn'>;
  /**
   * Reports deprecated usage once per process. The interceptor supplies this
   * only in development, so production logs stay quiet.
   */
  deprecationLogger?: Pick<Logger, 'warn'>;
}

/** Names already reported, so a hot route does not flood the log. */
const reportedUnsafeHeaders = new Set<string>();
const reportedAliases = new Set<string>();

/** Test seam: forget which unsafe-configuration warnings have been emitted. */
export function resetPublicContextDiagnostics(): void {
  reportedUnsafeHeaders.clear();
  reportedAliases.clear();
}

function joinHeaderValue(value: string | string[]): string {
  return Array.isArray(value) ? value.join(', ') : value;
}

/**
 * Collect the allowed request headers into a canonicalized bag.
 * Denied names are dropped and reported without their value.
 */
export function collectPublicHeaders(
  request: Pick<SSRRequest, 'headers'>,
  allowedHeaders: string[] | undefined,
  logger?: Pick<Logger, 'warn'>,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!allowedHeaders?.length) return headers;

  for (const rawName of allowedHeaders) {
    if (typeof rawName !== 'string') continue;
    const name = rawName.trim().toLowerCase();
    if (!name) continue;

    if (DENIED_HEADERS.has(name)) {
      if (!reportedUnsafeHeaders.has(name)) {
        reportedUnsafeHeaders.add(name);
        logger?.warn(
          `Refusing to expose credential header "${name}" to the client. ` +
            'Remove it from allowedHeaders; its value is never included in the render context.',
        );
      }
      continue;
    }

    const value = request.headers?.[name];
    if (value === undefined || value === null) continue;
    const joined = joinHeaderValue(value);
    if (joined === '') continue;
    headers[name] = joined;
  }

  return headers;
}

/**
 * Collect the allowed cookies into a bag. Only string values are exposed;
 * anything a cookie parser produced as an object is dropped.
 */
export function collectPublicCookies(
  request: { cookies?: Record<string, unknown> },
  allowedCookies: string[] | undefined,
): Record<string, string> {
  const cookies: Record<string, string> = {};
  const jar = request.cookies;
  if (!allowedCookies?.length || !jar) return cookies;

  for (const rawName of allowedCookies) {
    if (typeof rawName !== 'string') continue;
    const name = rawName.trim();
    if (!name) continue;
    const value = jar[name];
    if (typeof value === 'string') cookies[name] = value;
  }

  return cookies;
}

/**
 * Build the base public render context: URL data plus nested `headers` and
 * `cookies` bags.
 *
 * Nothing from the request reaches the top level except the URL and method
 * fields declared on {@link RenderContext}, so an allowed header can never
 * shadow `path` or an application context property.
 */
export function buildPublicContext(
  request: SSRRequest,
  options: PublicContextOptions = {},
): RenderContext {
  // Fastify requests do not have `.path`; derive it from the URL.
  const path = request.path ?? request.url?.split('?')[0] ?? '/';

  const headers = collectPublicHeaders(
    request,
    options.allowedHeaders,
    options.logger,
  );
  const cookies = collectPublicCookies(request, options.allowedCookies);

  const context: RenderContext = {
    url: request.url,
    path,
    // Copied into plain objects rather than passed through: both adapters
    // hand these over as their own parsed structures, and the render context
    // is the library's contract, not the adapter's.
    query: { ...((request.query ?? {}) as Record<string, string | string[]>) },
    params: { ...(request.params ?? {}) },
    method: request.method,
    headers,
    cookies,
  };

  // Deprecated: headers were previously mirrored as top-level properties.
  // Kept during the compatibility release so existing components keep
  // reading `context['x-tenant-id']`, but never for a reserved name.
  if (options.legacyHeaderAliases !== false) {
    for (const [name, value] of Object.entries(headers)) {
      if (RESERVED_CONTEXT_KEYS.has(name)) continue;
      (context as unknown as Record<string, unknown>)[name] = value;

      if (!reportedAliases.has(name)) {
        reportedAliases.add(name);
        options.deprecationLogger?.warn(
          `Request header "${name}" is exposed both at context.headers['${name}'] and as a ` +
            'top-level context property. The top-level alias is deprecated and will be removed ' +
            'in the next major; read it from context.headers instead.',
        );
      }
    }
  }

  return context;
}
