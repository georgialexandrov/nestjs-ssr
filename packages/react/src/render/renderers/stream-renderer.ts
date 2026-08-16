import { Injectable, Logger } from '@nestjs/common';
import type { HeadData, SSRResponse } from '../../interfaces';
import { TemplateParserService } from '../template-parser.service';
import { StreamingErrorHandler } from '../streaming-error-handler';
import { getRawResponse } from '../adapters';
import {
  loadServerModule,
  type RendererContext,
} from '../server-module-loader';
import { getComponentName } from '../component-name.util';
import { injectPlaceholder } from '../template.util';

export type StreamRenderContext = RendererContext;

/**
 * Streaming SSR renderer using React's renderToPipeableStream
 *
 * This renderer provides:
 * - Better TTFB (Time to First Byte)
 * - Progressive rendering with Suspense support
 * - Lower memory usage for large pages
 *
 * Trade-offs:
 * - More complex error handling (shell vs streaming errors)
 * - Errors after shell may result in partial responses with HTTP 200
 * - Requires careful Suspense boundary design
 *
 * Use this mode when:
 * - Performance is critical
 * - You're using Suspense for data fetching
 * - You understand the error handling implications
 */
@Injectable()
export class StreamRenderer {
  private readonly logger = new Logger(StreamRenderer.name);

  constructor(
    private readonly templateParser: TemplateParserService,
    private readonly streamingErrorHandler: StreamingErrorHandler,
  ) {}

  /**
   * Render a React component using streaming SSR
   *
   * @param viewComponent - The React component to render
   * @param data - Data to pass to the component
   * @param res - HTTP response object (Express or Fastify)
   * @param context - Render context with Vite and manifest info
   * @param head - Head data for SEO tags
   */
  async render(
    viewComponent: any,
    data: any,
    res: SSRResponse,
    context: StreamRenderContext,
    head?: HeadData,
  ): Promise<void> {
    const startTime = Date.now();
    let shellReadyTime = 0;
    const componentName = getComponentName(viewComponent);
    const rawRes = getRawResponse(res);

    // CRITICAL: Return a Promise that resolves only AFTER streaming is complete
    // This prevents NestJS from trying to end the response while streaming is in progress
    return new Promise((resolve, reject) => {
      let settled = false;
      let abortStream: (() => void) | undefined;

      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };

      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      const timeoutMs = context.timeoutMs ?? 10_000;
      const timer = setTimeout(() => {
        if (settled) return;
        abortStream?.();
        if (settled) return;
        try {
          this.streamingErrorHandler.handleShellError(
            new Error(
              `SSR render for ${componentName} timed out after ${timeoutMs}ms`,
            ),
            res,
            componentName,
            context.isDevelopment,
            context.nonce,
          );
        } finally {
          finish();
        }
      }, timeoutMs);
      timer.unref?.();

      const executeStream = async () => {
        let template = context.template;

        // In development, transform the template with Vite
        if (context.vite) {
          template = await context.vite.transformIndexHtml('/', template);
          if (settled) return;
        }

        // Parse template into parts
        const templateParts = this.templateParser.parseTemplate(template);

        const renderModule = await loadServerModule(context);
        if (settled) return;

        // Extract data, context, and layouts
        const {
          data: pageData,
          __context: pageContext,
          __layouts: layouts,
        } = data;

        // Build inline scripts (including layout metadata)
        const inlineScripts = this.templateParser.buildInlineScripts(
          pageData,
          pageContext,
          componentName,
          layouts,
          context.nonce,
        );

        // Assets come from the Vite dev server whenever one is attached;
        // otherwise from the production manifest
        const useDevAssets = context.vite !== null;
        const clientScript = this.templateParser.getClientScriptTag(
          useDevAssets,
          context.manifest,
          context.nonce,
        );

        const stylesheetTags = this.templateParser.getStylesheetTags(
          useDevAssets,
          context.manifest,
        );

        // Generate head tags
        const headTags = this.templateParser.buildHeadTags(head);

        // Build the closing chunk now so the 'end' handler stays simple.
        // Hydration scripts belong OUTSIDE the root div (matching string mode
        // and the template placeholders); writing them inside #root would
        // make them part of the hydrated tree.
        let closingChunk = templateParts.rootEnd;
        let htmlEnd = templateParts.htmlEnd;
        if (htmlEnd.includes('<!--initial-state-->')) {
          htmlEnd = injectPlaceholder(
            htmlEnd,
            '<!--initial-state-->',
            inlineScripts,
          );
        } else {
          closingChunk += inlineScripts;
        }
        if (htmlEnd.includes('<!--client-scripts-->')) {
          htmlEnd = injectPlaceholder(
            htmlEnd,
            '<!--client-scripts-->',
            clientScript,
          );
        } else {
          closingChunk += clientScript;
        }
        closingChunk += htmlEnd;

        // Set up streaming with error handlers
        let didError = false;
        let shellErrorOccurred = false;

        // Create a custom writable that we can control
        const { PassThrough } = await import('stream');
        const reactStream = new PassThrough();
        let allReadyFired = false;

        const { pipe, abort } = renderModule.renderComponentStream(
          viewComponent,
          data,
          {
            // React emits inline scripts for streamed Suspense boundaries.
            // Supplying the request nonce keeps those scripts CSP-compliant.
            nonce: context.nonce,
            onShellReady: () => {
              if (settled) return;
              // Shell is ready - start streaming
              shellReadyTime = Date.now();

              // Only set headers if they haven't been sent yet
              if (!rawRes.headersSent) {
                rawRes.statusCode = didError ? 500 : 200;
                rawRes.setHeader('Content-Type', 'text/html; charset=utf-8');
              }

              // Write HTML start with styles and head meta injected
              let htmlStart = templateParts.htmlStart;
              htmlStart = injectPlaceholder(
                htmlStart,
                '<!--styles-->',
                stylesheetTags,
              );
              htmlStart = injectPlaceholder(
                htmlStart,
                '<!--head-meta-->',
                headTags,
              );
              rawRes.write(htmlStart);

              // Write root div start
              rawRes.write(templateParts.rootStart);

              // Pipe React stream to our PassThrough stream
              pipe(reactStream);

              // Then pipe PassThrough to response
              reactStream.pipe(rawRes, { end: false });

              // Log TTFB (Time to First Byte) in development
              if (context.isDevelopment) {
                const ttfb = shellReadyTime - startTime;
                this.logger.log(
                  `[SSR] ${componentName} shell ready in ${ttfb}ms (stream mode - TTFB)`,
                );
              }
            },

            onShellError: (error: unknown) => {
              if (settled) return;
              // Error before shell ready - can still send error page
              shellErrorOccurred = true;
              this.streamingErrorHandler.handleShellError(
                error instanceof Error ? error : new Error(String(error)),
                res,
                componentName,
                context.isDevelopment,
                context.nonce,
              );
              // Resolve the promise since we've handled the error and sent a response
              finish();
            },

            onError: (error: unknown) => {
              if (settled) return;
              // Error during streaming - headers already sent
              didError = true;
              this.streamingErrorHandler.handleStreamError(
                error instanceof Error ? error : new Error(String(error)),
                componentName,
              );
            },

            onAllReady: () => {
              if (settled) return;
              // All content ready (including Suspense)
              // Note: We don't write closing tags here because the stream may still be flushing
              // We'll write them in the stream 'end' event instead
              allReadyFired = true;
            },
          },
        );
        abortStream = abort;

        // CRITICAL: Write closing tags and end response in stream 'end' event
        // This ensures all React content has been flushed before we write closing tags
        // AND we resolve the Promise here so NestJS doesn't interfere
        reactStream.on('end', () => {
          if (settled) return;
          // Don't write if shell error already handled the response
          if (shellErrorOccurred) {
            return;
          }

          // Close the root div, then hydration scripts and closing tags
          rawRes.write(closingChunk);
          rawRes.end();

          // Log completion
          if (context.isDevelopment) {
            const totalTime = Date.now() - startTime;
            const streamTime = Date.now() - shellReadyTime;
            const viaAllReady = allReadyFired
              ? ' (onAllReady fired)'
              : ' (onAllReady never fired)';
            this.logger.log(
              `[SSR] ${componentName} streaming complete in ${totalTime}ms total (${streamTime}ms streaming)${viaAllReady}`,
            );
          }

          // Resolve the Promise AFTER response is fully sent
          finish();
        });

        // Handle stream errors
        reactStream.on('error', (error) => {
          fail(error);
        });

        // Handle client disconnection
        rawRes.on('close', () => {
          abort();
          // If client disconnected, resolve to prevent hanging
          finish();
        });
      };

      // Execute the async function and handle errors
      executeStream().catch((error) => {
        if (settled) return;
        // Handle error before streaming started
        this.streamingErrorHandler.handleShellError(
          error instanceof Error ? error : new Error(String(error)),
          res,
          getComponentName(viewComponent),
          context.isDevelopment,
          context.nonce,
        );
        // Resolve after handling error
        finish();
      });
    });
  }
}
