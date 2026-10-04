import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ErrorPageDevelopment, ErrorPageProduction } from './error-pages';
import { loadedDevTools } from './dev-tools';
import type { ViteDevServer } from 'vite';
import type { ErrorPageDevelopmentProps, SSRResponse } from '../interfaces';
import { getRawResponse, isHeadersSent } from './adapters';

/** Development-only context for the error page's diagnostics. */
export interface DevErrorContext {
  vite?: ViteDevServer | null;
  root: string;
  vitePort?: number;
  request?: { method?: string; url?: string };
}

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
    res: SSRResponse,
    viewPath: string,
    isDevelopment: boolean,
    nonce?: string,
    devContext?: DevErrorContext,
  ): void {
    // Log error with context
    this.logger.error(
      `Shell error rendering ${viewPath}: ${error.message}`,
      error.stack,
    );

    // Get raw Node.js response (works with both Express and Fastify)
    const rawRes = getRawResponse(res);

    // Check if headers already sent (streaming already started)
    if (isHeadersSent(res)) {
      // Can't send proper error page - headers already sent, streaming in progress
      // But we CAN inject an error overlay into the stream
      this.logger.error(
        `Cannot send error page for ${viewPath} - headers already sent (streaming started)`,
      );
      if (!rawRes.writableEnded) {
        // Inject visible error overlay into the stream
        rawRes.write(
          this.renderInlineErrorOverlay(error, viewPath, isDevelopment, nonce),
        );
        rawRes.end();
      }
      return;
    }

    // Set error status
    rawRes.statusCode = 500;
    rawRes.setHeader('Content-Type', 'text/html; charset=utf-8');

    // Send error page - use rawRes.end() instead of res.send() for compatibility
    const html = isDevelopment
      ? this.renderDevelopmentErrorPage(
          error,
          viewPath,
          'shell',
          nonce,
          devContext,
        )
      : this.renderProductionErrorPage();

    rawRes.end(html);
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
    nonce?: string,
    devContext?: DevErrorContext,
  ): string {
    const ErrorComponent = this.errorPageDevelopment || ErrorPageDevelopment;

    const element = createElement(ErrorComponent, {
      error,
      viewPath,
      phase,
      nonce,
      // The diagnostics live in the development tooling, which development
      // loads at startup; without it the page falls back to the plain stack.
      details: devContext
        ? loadedDevTools()?.buildDevErrorDetails(error, devContext)
        : undefined,
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

  /**
   * Render inline error overlay for when headers are already sent
   * This gets injected into the stream to show a visible error UI
   */
  private renderInlineErrorOverlay(
    error: Error,
    viewPath: string,
    isDevelopment: boolean,
    nonce?: string,
  ): string {
    // The detailed overlay is development tooling, loaded at startup in
    // development; without it the generic overlay below is used.
    const dev = isDevelopment ? loadedDevTools() : undefined;
    if (dev) {
      return dev.devErrorOverlay(error, viewPath, nonce);
    }

    // Production: Show generic error without details
    return `
<div id="ssr-error-overlay" style="
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: #fff;
  color: #333;
  font-family: system-ui, -apple-system, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
">
  <div>
    <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Something went wrong</h1>
    <p style="color: #666; margin-bottom: 24px;">We're sorry, but something went wrong. Please try refreshing the page.</p>
    <a href="" style="
      background: #333;
      color: #fff;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      font-size: 16px;
    ">Refresh Page</a>
  </div>
</div>
`;
  }
}
