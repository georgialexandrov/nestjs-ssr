/**
 * Client-only exports for @nestjs-ssr/react
 * This module only exports React hooks and components safe for browser use.
 * Import from '@nestjs-ssr/react/client' in your client-side code.
 */

export {
  // Factory for creating typed hooks (use when extending RenderContext)
  createSSRHooks,
  PageContextProvider,
  // Pre-created hooks for direct use
  usePageContext,
  useParams,
  useQuery,
  useRequest,
  useHeaders,
  useHeader,
  useCookies,
  useCookie,
  // For advanced usage: update page context during navigation
  updatePageContext,
} from './react/hooks/use-page-context';

// Navigation
export {
  NavigationProvider,
  Link,
  navigate,
  useNavigation,
  useNavigationState,
  useNavigate,
  useIsNavigating,
} from './react/navigation';
export type { NavigateOptions, LinkProps } from './react/navigation';

// View-component resolution (used by entry-client.tsx for hydration).
// Exposes a single source of truth so the SSR entry and client navigation
// resolve components identically and surface same-name collisions clearly.
export {
  resolveViewComponent,
  buildComponentRegistry,
} from './react/navigation/resolve-component';
export type {
  ViewModule,
  ViewModuleRegistry,
  ComponentEntry,
  ResolveOptions,
} from './react/navigation/resolve-component';

export type { RenderContext } from './interfaces/render-context.interface';
export type { PageProps } from './interfaces/page-props.interface';
