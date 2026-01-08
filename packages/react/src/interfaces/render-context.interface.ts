/**
 * Request context available to all React components.
 * Contains safe request metadata that can be exposed to the client.
 *
 * Extend this interface to add app-specific properties (user, tenant, feature flags, etc.).
 * Use the `context` option in module configuration to enrich the context.
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
 * // Configure module with context factory to enrich context
 * RenderModule.forRoot({
 *   allowedCookies: ['theme', 'locale'],
 *   allowedHeaders: ['x-tenant-id'],
 *   context: ({ req }) => ({
 *     user: req.user,  // From Passport JWT strategy
 *     tenant: req.tenant,
 *     featureFlags: req.featureFlags,
 *   }),
 * })
 *
 * // Or with async factory (use forRootAsync)
 * RenderModule.forRootAsync({
 *   imports: [PermissionModule],
 *   inject: [PermissionService],
 *   useFactory: (permissionService) => ({
 *     context: async ({ req }) => ({
 *       user: req.user,
 *       permissions: await permissionService.getForUser(req.user),
 *     }),
 *   }),
 * })
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
  // RenderModule.forRoot({
  //   allowedHeaders: ['user-agent', 'accept-language', 'x-tenant-id'],
  //   allowedCookies: ['theme', 'locale']
  // })
}
