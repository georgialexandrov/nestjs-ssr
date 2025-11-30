/**
 * Client-side error reporting interface.
 * This mirrors the server-side ErrorReporter interface for consistency.
 */

/**
 * Context information captured when an error occurs on the client.
 */
export interface ClientErrorContext {
  // Component context
  componentPath?: string;
  componentStack?: string;

  // Browser context
  url?: string;
  userAgent?: string;

  // Environment metadata
  environment?: string;
  timestamp?: string;

  // Custom metadata
  [key: string]: any;
}

/**
 * Interface for client-side error reporting implementations.
 */
export interface ClientErrorReporter {
  /**
   * Report an error with optional context information.
   *
   * @param error - The error object to report
   * @param context - Additional context about where/when the error occurred
   */
  reportError(error: Error, context?: ClientErrorContext): void | Promise<void>;
}

/**
 * Default client-side error reporter that sends errors to the server.
 * Uses fetch API to POST errors to /api/errors endpoint.
 */
export class DefaultClientErrorReporter implements ClientErrorReporter {
  private endpoint: string;

  constructor(endpoint: string = '/api/errors') {
    this.endpoint = endpoint;
  }

  async reportError(error: Error, context?: ClientErrorContext): Promise<void> {
    try {
      const errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        context: {
          ...context,
          url: window.location.href,
          userAgent: navigator.userAgent,
          environment: process.env.NODE_ENV || 'production',
          timestamp: new Date().toISOString(),
        },
      };

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.error('[ClientErrorReporter]', error);
        console.error('[ClientErrorReporter] Context:', errorData.context);
      }

      // Send to server endpoint
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      }).catch((fetchError) => {
        // If sending fails, at least log to console
        console.error('[ClientErrorReporter] Failed to send error to server:', fetchError);
      });
    } catch (reportError) {
      // Never let error reporting itself throw
      console.error('[ClientErrorReporter] Error in reportError:', reportError);
    }
  }
}

/**
 * Console-only client error reporter (for development or when no server endpoint is available)
 */
export class ConsoleClientErrorReporter implements ClientErrorReporter {
  reportError(error: Error, context?: ClientErrorContext): void {
    const errorDetails = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        url: window.location.href,
        userAgent: navigator.userAgent,
        environment: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString(),
      },
    };

    console.error('[ConsoleClientErrorReporter]', error);
    console.error('[ConsoleClientErrorReporter] Details:', errorDetails);
  }
}

/**
 * Global error reporter instance.
 * Can be replaced with a custom implementation (e.g., Sentry).
 *
 * @example
 * ```typescript
 * // Use default (sends to server)
 * import { errorReporter } from '@view/error-reporter';
 *
 * // Or replace with custom implementation
 * import { setErrorReporter, DefaultClientErrorReporter } from '@view/error-reporter';
 * setErrorReporter(new DefaultClientErrorReporter('/custom-endpoint'));
 *
 * // Or use a third-party service
 * class SentryClientErrorReporter implements ClientErrorReporter {
 *   reportError(error: Error, context?: ClientErrorContext) {
 *     Sentry.captureException(error, { contexts: { custom: context } });
 *   }
 * }
 * setErrorReporter(new SentryClientErrorReporter());
 * ```
 */
let errorReporter: ClientErrorReporter = new DefaultClientErrorReporter();

/**
 * Replace the global error reporter with a custom implementation.
 */
export function setErrorReporter(reporter: ClientErrorReporter): void {
  errorReporter = reporter;
}

/**
 * Get the current error reporter instance.
 */
export function getErrorReporter(): ClientErrorReporter {
  return errorReporter;
}
