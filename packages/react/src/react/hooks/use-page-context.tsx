import { createContext, useContext } from 'react';
import type { RenderContext } from '../../interfaces/index';

// Create context for page metadata
const PageContext = createContext<RenderContext | null>(null);

/**
 * Provider component that makes page context available to all child components.
 * Should wrap the entire app in entry-server and entry-client.
 */
export function PageContextProvider({
  context,
  children,
}: {
  context: RenderContext;
  children: React.ReactNode;
}) {
  return (
    <PageContext.Provider value={context}>{children}</PageContext.Provider>
  );
}

/**
 * Hook to access the full page context.
 * Contains URL metadata and request headers.
 *
 * For apps with authentication, extend RenderContext and create custom hooks.
 *
 * @throws Error if used outside PageContextProvider
 *
 * @example
 * ```tsx
 * const context = usePageContext();
 * console.log(context.path);  // '/users/123'
 * console.log(context.query); // { search: 'foo' }
 * ```
 *
 * @example
 * // Custom hook for extended context
 * interface AppRenderContext extends RenderContext {
 *   user?: { id: string; name: string };
 * }
 *
 * export function useUser() {
 *   return (usePageContext() as AppRenderContext).user;
 * }
 */
export function usePageContext(): RenderContext {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('usePageContext must be used within PageContextProvider');
  }
  return context;
}

/**
 * Hook to access route parameters.
 *
 * @example
 * ```tsx
 * // Route: /users/:id
 * const params = useParams();
 * console.log(params.id); // '123'
 * ```
 */
export function useParams(): Record<string, string> {
  return usePageContext().params;
}

/**
 * Hook to access query string parameters.
 *
 * @example
 * ```tsx
 * // URL: /search?q=react&sort=date
 * const query = useQuery();
 * console.log(query.q);    // 'react'
 * console.log(query.sort); // 'date'
 * ```
 */
export function useQuery(): Record<string, string | string[]> {
  return usePageContext().query;
}

/**
 * Hook to access the User-Agent header.
 * Useful for device detection or analytics.
 *
 * @example
 * ```tsx
 * const userAgent = useUserAgent();
 * const isMobile = /Mobile/.test(userAgent || '');
 * ```
 */
export function useUserAgent(): string | undefined {
  return usePageContext().userAgent;
}

/**
 * Hook to access the Accept-Language header.
 * Useful for internationalization.
 *
 * @example
 * ```tsx
 * const language = useAcceptLanguage();
 * console.log(language); // 'en-US,en;q=0.9'
 * ```
 */
export function useAcceptLanguage(): string | undefined {
  return usePageContext().acceptLanguage;
}

/**
 * Hook to access the Referer header.
 * Useful for tracking where users came from.
 *
 * @example
 * ```tsx
 * const referer = useReferer();
 * if (referer) {
 *   console.log(`User came from: ${referer}`);
 * }
 * ```
 */
export function useReferer(): string | undefined {
  return usePageContext().referer;
}

/**
 * Alias for usePageContext() with a more intuitive name.
 * Returns the full request context with URL metadata and headers.
 *
 * @example
 * ```tsx
 * const request = useRequest();
 * console.log(request.path);   // '/users/123'
 * console.log(request.method); // 'GET'
 * console.log(request.params); // { id: '123' }
 * console.log(request.query);  // { search: 'foo' }
 * ```
 */
export function useRequest(): RenderContext {
  return usePageContext();
}
