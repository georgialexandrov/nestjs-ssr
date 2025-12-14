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
 * Vite configuration options for development
 *
 * In development, NestJS proxies requests to an external Vite dev server
 * which provides HMR (Hot Module Replacement) for React components.
 */
export interface ViteConfig {
  /**
   * Port where Vite dev server is running
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
   * - 'string': Traditional renderToString - atomic responses, proper HTTP status codes (default)
   * - 'stream': Modern renderToPipeableStream - better TTFB, Suspense support (advanced)
   *
   * String mode is recommended for most applications because:
   * - Atomic responses: either complete HTML or error page, never partial
   * - Proper HTTP status codes: 200 for success, 500 for errors
   * - Simpler error handling and debugging
   *
   * Use stream mode only when you need:
   * - Better Time to First Byte (TTFB) for performance-critical pages
   * - Progressive rendering with Suspense boundaries
   * - And you understand the trade-offs (errors after shell may result in HTTP 200 with partial content)
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
   * In development, run Vite separately (`pnpm dev:vite`) and NestJS will
   * proxy requests to it. This enables HMR for React components.
   *
   * @example
   * ```typescript
   * // Default port 5173
   * RenderModule.forRoot()
   *
   * // Custom Vite port
   * RenderModule.forRoot({
   *   vite: { port: 3001 }
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
   * RenderModule.forRoot({
   *   template: './src/views/custom-template.html'
   * })
   *
   * // Template string
   * RenderModule.forRoot({
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
   * RenderModule.forRoot({
   *   defaultHead: {
   *     title: 'My App',
   *     description: 'Default description',
   *     links: [{ rel: 'icon', href: '/favicon.ico' }]
   *   }
   * })
   * ```
   */
  defaultHead?: HeadData;

  /**
   * HTTP headers to pass to client
   * By default, no headers are passed for security
   * Use this to opt-in to specific headers that are safe to expose
   *
   * Common safe headers: user-agent, accept-language, referer
   * Security warning: Never include sensitive headers like authorization, cookie, etc.
   *
   * @default []
   *
   * @example
   * ```typescript
   * RenderModule.forRoot({
   *   allowedHeaders: ['user-agent', 'accept-language', 'x-tenant-id', 'x-api-version']
   * })
   * ```
   */
  allowedHeaders?: string[];

  /**
   * Cookie names to pass to client
   * By default, no cookies are passed to client for security
   * Use this to opt-in to specific cookies that are safe to expose
   *
   * Security warning: Never include sensitive cookies like session tokens, auth cookies, etc.
   *
   * @default []
   *
   * @example
   * ```typescript
   * RenderModule.forRoot({
   *   allowedCookies: ['theme', 'locale', 'consent']
   * })
   * ```
   */
  allowedCookies?: string[];
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
