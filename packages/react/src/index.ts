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

export { ReactRender } from './decorators/react-render.decorator';
export type { ViewPath, ViewPaths } from './decorators/react-render.decorator';

// ============================================================================
// Interfaces & Types
// ============================================================================

export type {
  RenderContext,
} from './interfaces/render-context.interface';

export type {
  PageProps,
} from './interfaces/page-props.interface';

export type {
  RenderConfig,
  SSRMode,
} from './interfaces/render-config.interface';

export type {
  RenderResponse,
  HeadData,
} from './interfaces/render-response.interface';

// ============================================================================
// React Hooks (for components)
// ============================================================================

export {
  usePageContext,
  useParams,
  useQuery,
  useUserAgent,
} from './react/hooks/use-page-context';

// ============================================================================
// Error Pages (customizable)
// ============================================================================

export { ErrorPageDevelopment } from './render/error-pages/error-page-development';
export { ErrorPageProduction } from './render/error-pages/error-page-production';

// ============================================================================
// Vite Integration (for build configuration)
// ============================================================================

export { viewRegistryPlugin } from './vite/view-registry-plugin';

