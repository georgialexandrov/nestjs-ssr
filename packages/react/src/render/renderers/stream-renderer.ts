import { Injectable, Logger } from '@nestjs/common';
import type { ViteDevServer } from 'vite';
import type { Response } from 'express';
import type { HeadData } from '../../interfaces';
import { TemplateParserService } from '../template-parser.service';
import { StreamingErrorHandler } from '../streaming-error-handler';

interface ViteManifest {
  [key: string]: {
    file: string;
    src?: string;
    isEntry?: boolean;
    imports?: string[];
    css?: string[];
  };
}

export interface StreamRenderContext {
  template: string;
  vite: ViteDevServer | null;
  manifest: ViteManifest | null;
  serverManifest: ViteManifest | null;
  entryServerPath: string;
  isDevelopment: boolean;
}

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
   * @param res - Express response object (required for streaming)
   * @param context - Render context with Vite and manifest info
   * @param head - Head data for SEO tags
   */
  async render(
    viewComponent: any,
    data: any,
    res: Response,
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

        // Import and use the SSR render function
        let renderModule;
        if (context.vite) {
          // Development: Use Vite's SSR loading with HMR support from package template
          renderModule = await context.vite.ssrLoadModule(
            context.entryServerPath,
          );
        } else {
          // Production: Import the built server bundle using manifest
          if (context.serverManifest) {
            // Find the entry file in the manifest (supports both old and new paths)
            const manifestEntry = Object.entries(context.serverManifest).find(
              ([key, value]: [string, any]) =>
                value.isEntry && key.includes('entry-server'),
            );

            if (manifestEntry) {
              const [, entry] = manifestEntry;
              const serverPath = `${process.cwd()}/dist/server/${entry.file}`;
              renderModule = await import(serverPath);
            } else {
              throw new Error(
                'Server bundle not found in manifest. Run `pnpm build:server` to generate the server bundle.',
              );
            }
          } else {
            throw new Error(
              'Server bundle not found in manifest. Run `pnpm build:server` to generate the server bundle.',
            );
          }
        }

        // Extract data, context, and layouts
        const {
          data: pageData,
          __context: pageContext,
          __layouts: layouts,
        } = data;

        // Get component name for client-side hydration and logging
        const componentName =
          viewComponent.displayName || viewComponent.name || 'Component';

        // Build inline scripts (including layout metadata)
        const inlineScripts = this.templateParser.buildInlineScripts(
          pageData,
          pageContext,
          componentName,
          layouts,
        );

        // Get client script tag
        const clientScript = this.templateParser.getClientScriptTag(
          context.isDevelopment,
          context.manifest,
        );

        // Get stylesheet tags
        const stylesheetTags = this.templateParser.getStylesheetTags(
          context.isDevelopment,
          context.manifest,
        );

        // Generate head tags
        const headTags = this.templateParser.buildHeadTags(head);

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
            onShellReady: () => {
              // Shell is ready - start streaming
              shellReadyTime = Date.now();

              // Only set headers if they haven't been sent yet
              if (!res.headersSent) {
                res.statusCode = didError ? 500 : 200;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
              }

              // Write HTML start with styles and head meta injected
              let htmlStart = templateParts.htmlStart;
              htmlStart = htmlStart.replace('<!--styles-->', stylesheetTags);
              htmlStart = htmlStart.replace('<!--head-meta-->', headTags);
              res.write(htmlStart);

              // Write root div start
              res.write(templateParts.rootStart);

              // Pipe React stream to our PassThrough stream
              pipe(reactStream);

              // Then pipe PassThrough to response
              reactStream.pipe(res, { end: false });

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

          // Write inline scripts
          res.write(inlineScripts);

          // Write client script
          res.write(clientScript);

          // Write root div end
          res.write(templateParts.rootEnd);

          // Write HTML end
          res.write(templateParts.htmlEnd);

          // End the response
          res.end();

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
        res.on('close', () => {
          abort();
          // If client disconnected, resolve to prevent hanging
          resolve();
        });
      };

      // Execute the async function and handle errors
      executeStream().catch((error) => {
        // Handle error before streaming started
        const componentName =
          typeof viewComponent === 'function'
            ? viewComponent.name
            : String(viewComponent);
        this.streamingErrorHandler.handleShellError(
          error as Error,
          res,
          componentName,
          context.isDevelopment,
        );
        // Resolve after handling error
        resolve();
      });
    });
  }
}
