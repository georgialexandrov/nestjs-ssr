/**
 * Context information captured when an error occurs.
 * This provides rich debugging information for error monitoring services.
 */
export interface ErrorContext {
  // Server request context
  url?: string;
  method?: string;
  params?: Record<string, string>;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  userId?: string;
  userAgent?: string;
  referer?: string;

  // Component/View context
  componentPath?: string;
  viewPath?: string;

  // React-specific context
  componentStack?: string;

  // Environment metadata
  environment?: string;
  timestamp?: string;

  // Custom metadata
  [key: string]: any;
}

/**
 * Interface for error reporting implementations.
 *
 * This minimal interface allows developers to plug in any error monitoring
 * service (Sentry, Datadog, OpenTelemetry, etc.) without being opinionated
 * about the implementation.
 *
 * @example
 * ```typescript
 * class SentryErrorReporter implements ErrorReporter {
 *   reportError(error: Error, context?: ErrorContext) {
 *     Sentry.captureException(error, {
 *       contexts: { custom: context }
 *     });
 *   }
 * }
 * ```
 */
export interface ErrorReporter {
  /**
   * Report an error with optional context information.
   *
   * @param error - The error object to report
   * @param context - Additional context about where/when the error occurred
   */
  reportError(error: Error, context?: ErrorContext): void | Promise<void>;
}
