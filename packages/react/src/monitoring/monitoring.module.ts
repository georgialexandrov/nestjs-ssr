import { Module, DynamicModule, Global } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ERROR_REPORTER } from './constants';
import type { ErrorReporter } from './interfaces';
import { ConsoleErrorReporter } from './reporters/console-error-reporter';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

/**
 * Configuration options for MonitoringModule.
 */
export interface MonitoringModuleOptions {
  /**
   * Custom ErrorReporter implementation.
   * If not provided, defaults to ConsoleErrorReporter (uses NestJS Logger).
   *
   * @example
   * ```typescript
   * MonitoringModule.forRoot({
   *   errorReporter: SentryErrorReporter
   * })
   * ```
   */
  errorReporter?: new (...args: any[]) => ErrorReporter;
}

/**
 * Global module for error monitoring and reporting.
 *
 * This module provides:
 * - ErrorReporter interface for pluggable error monitoring
 * - Default ConsoleErrorReporter (uses NestJS Logger)
 * - GlobalExceptionFilter (catches all server exceptions)
 * - Easy integration with Sentry, Datadog, OpenTelemetry, etc.
 *
 * @example Basic usage (default console logging):
 * ```typescript
 * @Module({
 *   imports: [MonitoringModule.forRoot()],
 * })
 * export class AppModule {}
 * ```
 *
 * @example With custom reporter (e.g., Sentry):
 * ```typescript
 * @Module({
 *   imports: [
 *     MonitoringModule.forRoot({
 *       errorReporter: SentryErrorReporter
 *     })
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({})
export class MonitoringModule {
  /**
   * Configure the monitoring module with optional custom error reporter.
   *
   * @param options - Configuration options
   * @returns Dynamic module with configured error reporting
   */
  static forRoot(options?: MonitoringModuleOptions): DynamicModule {
    const ErrorReporterClass = options?.errorReporter || ConsoleErrorReporter;

    return {
      module: MonitoringModule,
      providers: [
        {
          provide: ERROR_REPORTER,
          useClass: ErrorReporterClass,
        },
        {
          provide: APP_FILTER,
          useClass: GlobalExceptionFilter,
        },
      ],
      exports: [ERROR_REPORTER],
    };
  }
}
