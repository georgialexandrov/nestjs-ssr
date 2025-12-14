import React, { createContext, useContext, useState, useEffect } from 'react';
import type { RenderContext } from '../../interfaces/index';

/**
 * Global singleton pattern for PageContext.
 * This ensures that both @nestjs-ssr/react and @nestjs-ssr/react/client
 * share the same context instance, even when bundled separately by tsup.
 * Without this, each bundle creates its own context, causing
 * "useRequest must be used within PageContextProvider" errors.
 */
const CONTEXT_KEY = Symbol.for('nestjs-ssr.PageContext');

// Store context on globalThis using a Symbol key for guaranteed uniqueness
const globalStore = globalThis as unknown as {
  [key: symbol]: React.Context<RenderContext | null> | undefined;
};

function getOrCreateContext(): React.Context<RenderContext | null> {
  if (!globalStore[CONTEXT_KEY]) {
    globalStore[CONTEXT_KEY] = createContext<RenderContext | null>(null);
  }
  return globalStore[CONTEXT_KEY];
}

// Create context for page metadata - using singleton pattern
const PageContext = getOrCreateContext();

// Module-level setter for updating context during client-side navigation
let setPageContextState: ((context: RenderContext) => void) | null = null;

/**
 * Register the page context setter.
 * Called automatically when PageContextProvider mounts on the client.
 */
export function registerPageContextState(
  setter: (context: RenderContext) => void,
): void {
  setPageContextState = setter;
}

/**
 * Update the page context during client-side navigation.
 * Called by navigate() after successful navigation.
 */
export function updatePageContext(context: RenderContext): void {
  setPageContextState?.(context);
}

/**
 * Provider component that makes page context available to all child components.
 * Should wrap the entire app in entry-server and entry-client.
 * On the client, this provider is stateful and updates during navigation.
 *
 * @param isSegment - If true, this is a segment provider (for hydrated segments)
 *                    and won't register its setter to avoid overwriting the root provider's.
 */
export function PageContextProvider({
  context: initialContext,
  children,
  isSegment = false,
}: {
  context: RenderContext;
  children: React.ReactNode;
  isSegment?: boolean;
}) {
  const [context, setContext] = useState(initialContext);

  useEffect(() => {
    // Only root providers should register - segment providers inherit updates via window.__CONTEXT__
    if (!isSegment) {
      registerPageContextState(setContext);
    }
  }, [isSegment]);

  return (
    <PageContext.Provider value={context}>{children}</PageContext.Provider>
  );
}

/**
 * Factory function to create typed SSR hooks bound to your app's context type.
 * Use this once in your app to create hooks with full type safety.
 *
 * This eliminates the need to pass generic types to every hook call,
 * providing excellent DX with full IntelliSense support.
 *
 * @template T - Your extended RenderContext type with app-specific properties
 *
 * @example
 * ```typescript
 * // src/lib/ssr-hooks.ts - Define once
 * import { createSSRHooks, RenderContext } from '@nestjs-ssr/react';
 *
 * interface AppRenderContext extends RenderContext {
 *   user?: {
 *     id: string;
 *     name: string;
 *     email: string;
 *   };
 *   tenant?: { id: string; name: string };
 *   featureFlags?: Record<string, boolean>;
 *   theme?: string; // From cookie
 * }
 *
 * export const {
 *   usePageContext,
 *   useParams,
 *   useQuery,
 *   useRequest,
 *   useHeaders,
 *   useHeader,
 *   useCookies,
 *   useCookie,
 * } = createSSRHooks<AppRenderContext>();
 *
 * // Create custom helper hooks
 * export const useUser = () => usePageContext().user;
 * export const useTheme = () => useCookie('theme');
 * export const useUserAgent = () => useHeader('user-agent');
 * ```
 *
 * @example
 * ```typescript
 * // src/views/home.tsx - Use everywhere with full types
 * import { usePageContext, useUser, useTheme, useCookie, useHeader } from '@/lib/ssr-hooks';
 *
 * export default function Home() {
 *   const { user, featureFlags } = usePageContext(); // ✅ Fully typed!
 *   const user = useUser(); // ✅ Also typed!
 *   const theme = useTheme(); // ✅ From cookie
 *   const locale = useCookie('locale'); // ✅ Access specific cookie
 *   const tenantId = useHeader('x-tenant-id'); // ✅ Access specific header
 *
 *   return (
 *     <div>
 *       <h1>Welcome {user?.name}</h1>
 *       <p>Theme: {theme}</p>
 *       <p>Locale: {locale}</p>
 *       <p>Tenant: {tenantId}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function createSSRHooks<T extends RenderContext = RenderContext>() {
  return {
    /**
     * Hook to access the full page context with your app's type.
     * Contains URL metadata, headers, and any custom properties you've added.
     */
    usePageContext: (): T => {
      const context = useContext(PageContext);
      if (!context) {
        throw new Error(
          'usePageContext must be used within PageContextProvider',
        );
      }
      return context as T;
    },

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
    useParams: (): Record<string, string> => {
      const context = useContext(PageContext);
      if (!context) {
        throw new Error('useParams must be used within PageContextProvider');
      }
      return context.params;
    },

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
    useQuery: (): Record<string, string | string[]> => {
      const context = useContext(PageContext);
      if (!context) {
        throw new Error('useQuery must be used within PageContextProvider');
      }
      return context.query;
    },

    /**
     * Alias for usePageContext() with a more intuitive name.
     * Returns the full request context with your app's type.
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
    useRequest: (): T => {
      const context = useContext(PageContext);
      if (!context) {
        throw new Error('useRequest must be used within PageContextProvider');
      }
      return context as T;
    },

    /**
     * Hook to access headers configured via allowedHeaders.
     * Returns all headers as a Record.
     *
     * Configure in module registration:
     * ```typescript
     * RenderModule.forRoot({
     *   allowedHeaders: ['user-agent', 'x-tenant-id', 'x-api-version']
     * })
     * ```
     *
     * @example
     * ```tsx
     * const headers = useHeaders();
     * console.log(headers['user-agent']); // 'Mozilla/5.0...'
     * console.log(headers['x-tenant-id']); // 'tenant-123'
     * console.log(headers['x-api-version']); // 'v2'
     * ```
     */
    useHeaders: (): Record<string, string> => {
      const context = useContext(PageContext);
      if (!context) {
        throw new Error('useHeaders must be used within PageContextProvider');
      }

      // Extract headers (any property not in base RenderContext)
      const baseKeys = new Set([
        'url',
        'path',
        'query',
        'params',
        'method',
        'cookies',
      ]);

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(context)) {
        if (!baseKeys.has(key) && typeof value === 'string') {
          headers[key] = value;
        }
      }

      return headers;
    },

    /**
     * Hook to access a specific custom header by name.
     * Returns undefined if the header is not configured or not present.
     *
     * @param name - The header name (as configured in allowedHeaders)
     *
     * @example
     * ```tsx
     * const tenantId = useHeader('x-tenant-id');
     * if (tenantId) {
     *   console.log(`Tenant: ${tenantId}`);
     * }
     * ```
     */
    useHeader: (name: string): string | undefined => {
      const context = useContext(PageContext);
      if (!context) {
        throw new Error('useHeader must be used within PageContextProvider');
      }
      const value = (context as unknown as Record<string, unknown>)[name];
      return typeof value === 'string' ? value : undefined;
    },

    /**
     * Hook to access cookies configured via allowedCookies.
     * Returns all allowed cookies as a Record.
     *
     * Configure in module registration:
     * ```typescript
     * RenderModule.forRoot({
     *   allowedCookies: ['theme', 'locale', 'consent']
     * })
     * ```
     *
     * @example
     * ```tsx
     * const cookies = useCookies();
     * console.log(cookies.theme);  // 'dark'
     * console.log(cookies.locale); // 'en-US'
     * ```
     */
    useCookies: (): Record<string, string> => {
      const context = useContext(PageContext);
      if (!context) {
        throw new Error('useCookies must be used within PageContextProvider');
      }
      const cookies = (context as unknown as Record<string, unknown>).cookies;
      return typeof cookies === 'object' && cookies !== null
        ? (cookies as Record<string, string>)
        : {};
    },

    /**
     * Hook to access a specific cookie by name.
     * Returns undefined if the cookie is not configured or not present.
     *
     * @param name - The cookie name (as configured in allowedCookies)
     *
     * @example
     * ```tsx
     * const theme = useCookie('theme');
     * if (theme === 'dark') {
     *   console.log('Dark mode enabled');
     * }
     * ```
     */
    useCookie: (name: string): string | undefined => {
      const context = useContext(PageContext);
      if (!context) {
        throw new Error('useCookie must be used within PageContextProvider');
      }
      const contextObj = context as unknown as Record<string, unknown>;
      const cookies = contextObj.cookies;
      if (
        typeof cookies === 'object' &&
        cookies !== null &&
        !Array.isArray(cookies)
      ) {
        const cookiesRecord = cookies as Record<string, unknown>;
        const value = cookiesRecord[name];
        return typeof value === 'string' ? value : undefined;
      }
      return undefined;
    },
  };
}

/**
 * Pre-created hooks for direct use without calling createSSRHooks().
 * Use these when you don't need to extend the RenderContext type.
 *
 * For typed extensions, use createSSRHooks<YourContextType>() instead.
 *
 * @example
 * ```tsx
 * import { usePageContext, useParams, useCookie } from '@nestjs-ssr/react/client';
 *
 * export default function Page() {
 *   const { path } = usePageContext();
 *   const { id } = useParams();
 *   const theme = useCookie('theme');
 *   return <div>...</div>;
 * }
 * ```
 */
const defaultHooks = createSSRHooks<RenderContext>();

export const usePageContext = defaultHooks.usePageContext;
export const useParams = defaultHooks.useParams;
export const useQuery = defaultHooks.useQuery;
export const useRequest = defaultHooks.useRequest;
export const useHeaders = defaultHooks.useHeaders;
export const useHeader = defaultHooks.useHeader;
export const useCookies = defaultHooks.useCookies;
export const useCookie = defaultHooks.useCookie;
