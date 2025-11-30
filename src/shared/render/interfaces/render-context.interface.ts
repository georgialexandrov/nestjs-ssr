/**
 * Request context available to all React components.
 * Contains safe request metadata that can be exposed to the client.
 *
 * @example
 * // Basic usage - use as-is
 * const context: RenderContext = {
 *   url: '/users/123',
 *   path: '/users/123',
 *   query: { tab: 'profile' },
 *   params: { id: '123' },
 * };
 *
 * @example
 * // Extended usage - add custom properties for your app
 * interface AppRenderContext extends RenderContext {
 *   user?: {
 *     id: string;
 *     name: string;
 *     email: string;
 *     roles: string[];
 *   };
 *   tenant?: {
 *     id: string;
 *     name: string;
 *   };
 *   locale?: string;
 * }
 *
 * // Use in interceptor
 * const context: AppRenderContext = {
 *   ...baseContext,
 *   user: req.user,
 *   tenant: req.tenant,
 *   locale: req.locale,
 * };
 */
export interface RenderContext {
  // URL information
  url: string; // Full URL
  path: string; // Path only (/users/123)
  query: Record<string, string | string[]>; // Query params (?search=foo)
  params: Record<string, string>; // Route params (/:id)

  // Request headers (safe subset only)
  userAgent?: string; // User-Agent header
  acceptLanguage?: string; // Accept-Language header
  referer?: string; // Referer header

  // Extensible for custom metadata
  // Use interface extension to add app-specific properties (see examples above)
  [key: string]: any;
}
