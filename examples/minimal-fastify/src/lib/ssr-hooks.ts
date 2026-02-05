import { createSSRHooks, RenderContext } from '@nestjs-ssr/react/client';

/**
 * App-specific user type that matches what the auth guard sets
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

/**
 * Extended RenderContext with app-specific properties.
 * These are populated by the context factory in app.module.ts
 */
export interface AppRenderContext extends RenderContext {
  user?: User;
}

/**
 * Create typed hooks bound to our app's context type.
 * Use these throughout the app for full type safety.
 */
export const {
  usePageContext,
  useParams,
  useQuery,
  useRequest,
  useHeaders,
  useHeader,
  useCookies,
  useCookie,
} = createSSRHooks<AppRenderContext>();

/**
 * Convenience hook to access the current user.
 * Returns undefined if not authenticated.
 */
export const useUser = () => usePageContext().user;
