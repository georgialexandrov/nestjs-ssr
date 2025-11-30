import { Injectable, Logger } from '@nestjs/common';
import type { ErrorReporter, ErrorContext } from '../interfaces';

/**
 * Default error reporter implementation using NestJS Logger.
 *
 * This implementation logs errors to the console using NestJS's built-in
 * Logger service, which provides consistent formatting and log levels.
 *
 * In production, you can replace this with a custom implementation that
 * sends errors to Sentry, Datadog, OpenTelemetry, or any other monitoring service.
 */
@Injectable()
export class ConsoleErrorReporter implements ErrorReporter {
  private readonly logger = new Logger(ConsoleErrorReporter.name);

  reportError(error: Error, context?: ErrorContext): void {
    const errorDetails = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...context,
    };

    const location = context?.componentPath || context?.viewPath || context?.url || 'Unknown';
    const contextString = JSON.stringify(errorDetails, null, 2);

    // Use NestJS Logger.error() instead of console.log
    this.logger.error(
      `[${location}] ${error.message}`,
      error.stack,
      contextString,
    );
  }
}
