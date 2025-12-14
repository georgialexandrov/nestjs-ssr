import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import escapeHtml from 'escape-html';
import { uneval } from 'devalue';
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

    // Check if headers already sent (streaming already started)
    if (res.headersSent) {
      // Can't send proper error page - headers already sent, streaming in progress
      // But we CAN inject an error overlay into the stream
      this.logger.error(
        `Cannot send error page for ${viewPath} - headers already sent (streaming started)`,
      );
      if (!res.writableEnded) {
        // Inject visible error overlay into the stream
        res.write(
          this.renderInlineErrorOverlay(error, viewPath, isDevelopment),
        );
        res.end();
      }
      return;
    }

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

  /**
   * Render inline error overlay for when headers are already sent
   * This gets injected into the stream to show a visible error UI
   */
  private renderInlineErrorOverlay(
    error: Error,
    viewPath: string,
    isDevelopment: boolean,
  ): string {
    const errorMessage = escapeHtml(error.message);
    const errorStack = escapeHtml(error.stack || '');
    const escapedViewPath = escapeHtml(viewPath);

    if (isDevelopment) {
      return `
<div id="ssr-error-overlay" style="
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 14px;
  padding: 32px;
  overflow: auto;
">
  <div style="max-width: 900px; margin: 0 auto;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
      <span style="font-size: 32px;">⚠️</span>
      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ff6b6b;">
        SSR Streaming Error
      </h1>
    </div>
    <p style="color: #aaa; margin-bottom: 16px;">
      An error occurred after streaming started in <code style="background: #333; padding: 2px 6px; border-radius: 4px;">${escapedViewPath}</code>
    </p>
    <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <div style="color: #ff6b6b; font-weight: 600; margin-bottom: 8px;">Error Message:</div>
      <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; color: #fff;">${errorMessage}</pre>
    </div>
    <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 16px;">
      <div style="color: #888; font-weight: 600; margin-bottom: 8px;">Stack Trace:</div>
      <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; color: #888; font-size: 12px;">${errorStack}</pre>
    </div>
    <button onclick="document.getElementById('ssr-error-overlay').remove()" style="
      margin-top: 24px;
      background: #333;
      color: #fff;
      border: 1px solid #555;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
    ">Dismiss</button>
  </div>
</div>
<script>console.error('SSR Streaming Error in ${escapedViewPath}:', ${uneval(error.message)});</script>
`;
    } else {
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
    <button onclick="location.reload()" style="
      background: #333;
      color: #fff;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      font-size: 16px;
    ">Refresh Page</button>
  </div>
</div>
`;
    }
  }
}
