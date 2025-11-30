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
// Monitoring (Optional)
// ============================================================================

export { MonitoringModule } from './monitoring/monitoring.module';
export { GlobalExceptionFilter } from './monitoring/filters/global-exception.filter';
export { ConsoleErrorReporter } from './monitoring/reporters/console-error-reporter';

export type {
  ErrorReporter,
  ErrorContext,
} from './monitoring/interfaces/error-reporter.interface';

export {
  ERROR_REPORTER,
} from './monitoring/constants';

// ============================================================================
// Vite Integration (for build configuration)
// ============================================================================

export { viewRegistryPlugin } from './vite/view-registry-plugin';

// ============================================================================
// React Entry Points (for consumer's Vite config)
// Note: These are template files that consumers should copy/customize
// ============================================================================

// Re-export React integration for advanced use cases
export { default as AppWrapper } from './react/app-wrapper';
