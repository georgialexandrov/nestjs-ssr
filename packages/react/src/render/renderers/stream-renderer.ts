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

    // CRITICAL: Return a Promise that resolves only AFTER streaming is complete
    // This prevents NestJS from trying to end the response while streaming is in progress
    return new Promise((resolve, reject) => {
      const executeStream = async () => {
        let template = context.template;

        // In development, transform the template with Vite
        if (context.vite) {
          template = await context.vite.transformIndexHtml('/', template);
        }

        // Parse template into parts
        const templateParts = this.templateParser.parseTemplate(template);

        const renderModule = await loadServerModule(context);

        // Extract data, context, and layouts
        const {
          data: pageData,
          __context: pageContext,
          __layouts: layouts,
        } = data;

        const componentName = getComponentName(viewComponent);

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

        // Get raw Node.js response for streaming (works with both Express and Fastify)
        const rawRes = getRawResponse(res);

        const { pipe, abort } = renderModule.renderComponentStream(
          viewComponent,
          data,
          {
            onShellReady: () => {
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

            onShellError: (error: Error) => {
              // Error before shell ready - can still send error page
              shellErrorOccurred = true;
              this.streamingErrorHandler.handleShellError(
                error,
                res,
                componentName,
                context.isDevelopment,
              );
              // Resolve the promise since we've handled the error and sent a response
              resolve();
            },

            onError: (error: Error) => {
              // Error during streaming - headers already sent
              didError = true;
              this.streamingErrorHandler.handleStreamError(
                error,
                componentName,
              );
            },

            onAllReady: () => {
              // All content ready (including Suspense)
              // Note: We don't write closing tags here because the stream may still be flushing
              // We'll write them in the stream 'end' event instead
              allReadyFired = true;
            },
          },
        );

        // CRITICAL: Write closing tags and end response in stream 'end' event
        // This ensures all React content has been flushed before we write closing tags
        // AND we resolve the Promise here so NestJS doesn't interfere
        reactStream.on('end', () => {
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
          resolve();
        });

        // Handle stream errors
        reactStream.on('error', (error) => {
          reject(error);
        });

        // Handle client disconnection
        rawRes.on('close', () => {
          abort();
          // If client disconnected, resolve to prevent hanging
          resolve();
        });
      };

      // Execute the async function and handle errors
      executeStream().catch((error) => {
        // Handle error before streaming started
        this.streamingErrorHandler.handleShellError(
          error as Error,
          res,
          getComponentName(viewComponent),
          context.isDevelopment,
        );
        // Resolve after handling error
        resolve();
      });
    });
  }
}
