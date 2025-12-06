import type { ComponentType } from 'react';

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
