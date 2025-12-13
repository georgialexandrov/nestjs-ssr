/**
 * Client-only exports for @nestjs-ssr/react
 * This module only exports React hooks and components safe for browser use.
 * Import from '@nestjs-ssr/react/client' in your client-side code.
 */

export {
  createSSRHooks,
  PageContextProvider,
} from './react/hooks/use-page-context';

export type { RenderContext } from './interfaces/render-context.interface';
export type { PageProps } from './interfaces/page-props.interface';
