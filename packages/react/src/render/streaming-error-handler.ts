import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ErrorPageDevelopment, ErrorPageProduction } from './error-pages';
import type { ErrorPageDevelopmentProps } from '../interfaces';

/**
 * Error handling strategies for streaming SSR
 *
 * Streaming has different error phases:
 * 1. Shell errors: Before any content sent (can send 500)
 * 2. Stream errors: After headers sent (can only log)
 * 3. Client errors: Handled by ErrorBoundary
 */
@Injectable()
export class StreamingErrorHandler {
  private readonly logger = new Logger(StreamingErrorHandler.name);

  constructor(
    @Optional()
    @Inject('ERROR_PAGE_DEVELOPMENT')
    private readonly errorPageDevelopment?: ComponentType<ErrorPageDevelopmentProps>,
    @Optional()
    @Inject('ERROR_PAGE_PRODUCTION')
    private readonly errorPageProduction?: ComponentType,
  ) {}

  /**
   * Handle error that occurred before shell was ready
   * Can still set HTTP status code and send error page
   */
  handleShellError(
    error: Error,
    res: Response,
    viewPath: string,
    isDevelopment: boolean,
  ): void {
    // Log error with context
    this.logger.error(
      `Shell error rendering ${viewPath}: ${error.message}`,
      error.stack,
    );

    // Set error status
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    // Send error page
    if (isDevelopment) {
      // Development: Show detailed error
      res.send(this.renderDevelopmentErrorPage(error, viewPath, 'shell'));
    } else {
      // Production: Generic error message
      res.send(this.renderProductionErrorPage());
    }
  }

  /**
   * Handle error that occurred during streaming
   * Headers already sent, can only log the error
   */
  handleStreamError(error: Error, viewPath: string): void {
    // Log error with context
    this.logger.error(
      `Streaming error rendering ${viewPath}: ${error.message}`,
      error.stack,
    );

    // Cannot send error page (headers already sent)
    // Error will be logged, and partial content already delivered
    // Client ErrorBoundary should handle gracefully
  }

  /**
   * Render development error page using React component
   */
  private renderDevelopmentErrorPage(
    error: Error,
    viewPath: string,
    phase: 'shell' | 'streaming',
  ): string {
    const ErrorComponent = this.errorPageDevelopment || ErrorPageDevelopment;

    const element = createElement(ErrorComponent, {
      error,
      viewPath,
      phase,
    });

    return '<!DOCTYPE html>\n' + renderToStaticMarkup(element);
  }

  /**
   * Render production error page using React component
   */
  private renderProductionErrorPage(): string {
    const ErrorComponent = this.errorPageProduction || ErrorPageProduction;

    const element = createElement(ErrorComponent);

    return '<!DOCTYPE html>\n' + renderToStaticMarkup(element);
  }
}
