import type { ComponentType } from 'react';
import type { HeadData } from './render-response.interface';

/**
 * SSR rendering mode configuration
 */
export type SSRMode = 'string' | 'stream';

/**
 * Props for development error page component
 */
export interface ErrorPageDevelopmentProps {
  error: Error;
  viewPath: string;
  phase: 'shell' | 'streaming';
}

/**
 * Vite development mode configuration
 */
export type ViteMode = 'proxy' | 'embedded';

/**
 * Vite configuration options
 */
export interface ViteConfig {
  /**
   * Vite mode for development
   * - 'embedded': Vite runs inside NestJS (no HMR, simplest setup) - DEFAULT
   * - 'proxy': External Vite server with HMR support (requires running `vite` separately)
   *
   * @default 'embedded'
   */
  mode?: ViteMode;

  /**
   * Port where external Vite dev server is running (proxy mode only)
   *
   * @default 5173
   */
  port?: number;
}

/**
 * Configuration options for the render module
 */
export interface RenderConfig {
  /**
   * SSR rendering mode
   * - 'string': Traditional renderToString (simple, proven, easier debugging)
   * - 'stream': Modern renderToPipeableStream (better performance, progressive rendering)
   *
   * @default 'string'
   */
  mode?: SSRMode;

  /**
   * Timeout in milliseconds for SSR rendering.
   * If rendering takes longer than this, the request will be aborted.
   *
   * @default 10000 (10 seconds)
   */
  timeout?: number;

  /**
   * Vite configuration for development
   *
   * @example
   * ```typescript
   * // Zero config - embedded mode by default (simplest)
   * @Module({
   *   imports: [RenderModule],
   * })
   *
   * // Proxy mode - external Vite with HMR
   * @Module({
   *   imports: [
   *     RenderModule.register({
   *       vite: { mode: 'proxy', port: 5173 }
   *     })
   *   ],
   * })
   * ```
   */
  vite?: ViteConfig;

  /**
   * Custom HTML template for SSR
   * Provide either a file path or template string
   *
   * @example
   * ```typescript
   * // File path (absolute or relative to cwd)
   * RenderModule.register({
   *   template: './src/views/custom-template.html'
   * })
   *
   * // Template string
   * RenderModule.register({
   *   template: `<!DOCTYPE html>
   *     <html>
   *       <head><!--styles--></head>
   *       <body>
   *         <div id="root"><!--app-html--></div>
   *         <!--initial-state-->
   *         <!--client-scripts-->
   *       </body>
   *     </html>`
   * })
   * ```
   */
  template?: string;

  /**
   * Custom error page component for development environment
   * Receives error details and renders custom error UI
   *
   * @default ErrorPageDevelopment from '@shared/render/error-pages'
   */
  errorPageDevelopment?: ComponentType<ErrorPageDevelopmentProps>;

  /**
   * Custom error page component for production environment
   * Renders generic error without sensitive details
   *
   * @default ErrorPageProduction from '@shared/render/error-pages'
   */
  errorPageProduction?: ComponentType;

  /**
   * Default head data for all pages
   * Can be overridden per-page by returning head in controller
   *
   * For dynamic default head (e.g., from database), use registerAsync
   *
   * @example
   * ```typescript
   * RenderModule.register({
   *   defaultHead: {
   *     title: 'My App',
   *     description: 'Default description',
   *     links: [{ rel: 'icon', href: '/favicon.ico' }]
   *   }
   * })
   * ```
   */
  defaultHead?: HeadData;
}

/**
 * Template parts for streaming SSR
 * Template is split into parts that are written around the React stream
 */
export interface TemplateParts {
  /** HTML start through <body> tag */
  htmlStart: string;

  /** Opening <div id="root"> tag */
  rootStart: string;

  /** Closing </div> tag for root */
  rootEnd: string;

  /** Closing </body></html> tags */
  htmlEnd: string;
}

/**
 * Streaming render callbacks
 */
export interface StreamCallbacks {
  /**
   * Called when the shell (initial HTML structure) is ready to be sent
   * At this point, headers can still be set
   */
  onShellReady?: () => void;

  /**
   * Called when an error occurs before the shell is ready
   * Response can still send error status and page
   */
  onShellError?: (error: Error) => void;

  /**
   * Called when an error occurs during streaming
   * Headers are already sent, can only log error
   */
  onError?: (error: Error) => void;

  /**
   * Called when all content (including Suspense) is ready
   * Not typically used for streaming (defeats the purpose)
   */
  onAllReady?: () => void;
}
