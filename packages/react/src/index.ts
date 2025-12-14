/**
 * @nestjs-ssr/react
 *
 * Elegant React SSR for NestJS. Zero-config, fully typed, production-ready.
 * Following the UnJS philosophy: unintrusive, minimal, framework-agnostic.
 */

// ============================================================================
// Core Rendering
// ============================================================================

export { RenderModule } from './render/render.module';
export { RenderService } from './render/render.service';
export { RenderInterceptor } from './render/render.interceptor';
export { TemplateParserService } from './render/template-parser.service';
export { StreamingErrorHandler } from './render/streaming-error-handler';

// ============================================================================
// Decorators
// ============================================================================

export { Render } from './decorators/react-render.decorator';
export type { RenderOptions } from './decorators/react-render.decorator';
export { Layout } from './decorators/layout.decorator';
export type { LayoutDecoratorOptions } from './decorators/layout.decorator';

// ============================================================================
// Interfaces & Types
// ============================================================================

export type { RenderContext } from './interfaces/render-context.interface';

export type { PageProps } from './interfaces/page-props.interface';

export type {
  RenderConfig,
  SSRMode,
} from './interfaces/render-config.interface';

export type {
  RenderResponse,
  HeadData,
} from './interfaces/render-response.interface';

export type {
  LayoutProps,
  LayoutComponent,
  PageComponentWithLayout,
} from './interfaces/layout.interface';

// ============================================================================
// React Hooks (for components)
// ============================================================================

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
} from './react/hooks/use-page-context';

// ============================================================================
// Error Pages (customizable)
// ============================================================================

export { ErrorPageDevelopment } from './render/error-pages/error-page-development';
export { ErrorPageProduction } from './render/error-pages/error-page-production';
