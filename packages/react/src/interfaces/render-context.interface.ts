/**
 * Request context available to all React components.
 * Contains safe request metadata that can be exposed to the client.
 *
 * Extend this interface to add app-specific properties (user, tenant, feature flags, etc.).
 * Use module configuration to pass additional headers or cookies safely.
 *
 * @example
 * // Basic usage - use as-is
 * const context: RenderContext = {
 *   url: '/users/123',
 *   path: '/users/123',
 *   query: { tab: 'profile' },
 *   params: { id: '123' },
 *   method: 'GET',
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
 *   featureFlags?: Record<string, boolean>;
 *   theme?: string;  // From cookie
 * }
 *
 * // Configure module to pass specific cookies/headers
 * ReactSSRModule.forRoot({
 *   allowedCookies: ['theme', 'locale'],
 *   allowedHeaders: ['x-tenant-id'],
 * })
 *
 * // Use in interceptor/controller
 * const context: AppRenderContext = {
 *   ...baseContext,
 *   user: req.user,
 *   tenant: req.tenant,
 *   featureFlags: await featureFlagService.getFlags(req),
 * };
 */
export interface RenderContext {
  // URL information
  url: string; // Full URL
  path: string; // Path only (/users/123)
  query: Record<string, string | string[]>; // Query params (?search=foo)
  params: Record<string, string>; // Route params (/:id)

  // Request metadata
  method: string; // HTTP method (GET, POST, etc.)

  // Extend this interface to add app-specific properties
  // Do not use [key: string]: any - use proper interface extension for type safety
  //
  // For headers and cookies, use allowedHeaders and allowedCookies in module configuration:
  // RenderModule.register({
  //   allowedHeaders: ['user-agent', 'accept-language', 'x-tenant-id'],
  //   allowedCookies: ['theme', 'locale']
  // })
}
