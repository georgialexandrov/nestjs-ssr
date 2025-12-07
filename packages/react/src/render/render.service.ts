import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import serialize from 'serialize-javascript';
import type { ViteDevServer } from 'vite';
import type { Response } from 'express';
import { Writable } from 'stream';
import type { SSRMode, HeadData } from '../interfaces';
import { TemplateParserService } from './template-parser.service';
import { StreamingErrorHandler } from './streaming-error-handler';

interface ViteManifest {
  [key: string]: {
    file: string;
    src?: string;
    isEntry?: boolean;
    imports?: string[];
    css?: string[];
  };
}

@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);
  private vite: ViteDevServer | null = null;
  private template: string;
  private manifest: ViteManifest | null = null;
  private serverManifest: ViteManifest | null = null;
  private isDevelopment: boolean;
  private ssrMode: SSRMode;

  constructor(
    private readonly templateParser: TemplateParserService,
    private readonly streamingErrorHandler: StreamingErrorHandler,
    @Optional() @Inject('SSR_MODE') ssrMode?: SSRMode,
    @Optional() @Inject('DEFAULT_HEAD') private readonly defaultHead?: HeadData,
  ) {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.ssrMode = ssrMode || (process.env.SSR_MODE as SSRMode) || 'string';

    // Load HTML template
    const templatePath = this.isDevelopment
      ? join(process.cwd(), 'src/view/index.html')
      : join(process.cwd(), 'dist/client/index.html');

    if (!existsSync(templatePath)) {
      throw new Error(
        `Template file not found at ${templatePath}. ` +
        `Make sure to create index.html in ${this.isDevelopment ? 'src/view/' : 'dist/client/'}`,
      );
    }

    try {
      this.template = readFileSync(templatePath, 'utf-8');
      this.logger.log(`✓ Loaded template from ${templatePath}`);
    } catch (error: any) {
      throw new Error(
        `Failed to read template file at ${templatePath}: ${error.message}`,
      );
    }

    // In production, load the Vite manifests to get hashed filenames
    if (!this.isDevelopment) {
      // Load client manifest
      const manifestPath = join(
        process.cwd(),
        'dist/client/.vite/manifest.json',
      );
      if (existsSync(manifestPath)) {
        this.manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      } else {
        this.logger.warn(
          '⚠️  Client manifest not found. Run `pnpm build:client` first.',
        );
      }

      // Load server manifest
      const serverManifestPath = join(
        process.cwd(),
        'dist/server/.vite/manifest.json',
      );
      if (existsSync(serverManifestPath)) {
        this.serverManifest = JSON.parse(
          readFileSync(serverManifestPath, 'utf-8'),
        );
      } else {
        this.logger.warn(
          '⚠️  Server manifest not found. Run `pnpm build:server` first.',
        );
      }
    }
  }

  setViteServer(vite: ViteDevServer) {
    this.vite = vite;
  }

  /**
   * Main render method that routes to string or stream mode
   */
  async render(
    viewPath: string,
    data: any = {},
    res?: Response,
    head?: HeadData,
  ): Promise<string | void> {
    // Merge default head with page-specific head
    const mergedHead = this.mergeHead(this.defaultHead, head);

    if (this.ssrMode === 'stream') {
      if (!res) {
        throw new Error(
          'Response object is required for streaming SSR mode. Pass res as third parameter.',
        );
      }
      return this.renderToStream(viewPath, data, res, mergedHead);
    }
    return this.renderToString(viewPath, data, mergedHead);
  }

  /**
   * Merge default head with page-specific head
   * Page-specific head values override defaults
   */
  private mergeHead(defaultHead?: HeadData, pageHead?: HeadData): HeadData | undefined {
    if (!defaultHead && !pageHead) {
      return undefined;
    }

    return {
      ...defaultHead,
      ...pageHead,
      // Merge arrays (links and meta) instead of replacing
      links: [
        ...(defaultHead?.links || []),
        ...(pageHead?.links || []),
      ],
      meta: [
        ...(defaultHead?.meta || []),
        ...(pageHead?.meta || []),
      ],
    };
  }

  /**
   * Traditional string-based SSR using renderToString
   */
  private async renderToString(
    viewPath: string,
    data: any = {},
    head?: HeadData,
  ): Promise<string> {
    const startTime = Date.now();

    try {
      let template = this.template;

      // In development, transform the template with Vite
      if (this.vite) {
        template = await this.vite.transformIndexHtml('/', template);
      }

      // Import and use the SSR render function
      let renderModule;
      if (this.vite) {
        // Development: Use Vite's SSR loading with HMR support
        renderModule = await this.vite.ssrLoadModule(
          '/src/view/entry-server.tsx',
        );
      } else {
        // Production: Import the built server bundle using manifest
        if (
          this.serverManifest &&
          this.serverManifest['src/view/entry-server.tsx']
        ) {
          const serverFile =
            this.serverManifest['src/view/entry-server.tsx'].file;
          const serverPath = join(process.cwd(), 'dist/server', serverFile);
          renderModule = await import(serverPath);
        } else {
          throw new Error(
            'Server bundle not found in manifest. Run `pnpm build:server` to generate the server bundle.',
          );
        }
      }

      // Extract data and context
      const { data: pageData, __context: context } = data;

      // Render the React component
      const appHtml = await renderModule.renderComponent(viewPath, data);

      // Serialize initial state and context for client
      const initialStateScript = `
        <script>
          window.__INITIAL_STATE__ = ${serialize(pageData, { isJSON: true })};
          window.__CONTEXT__ = ${serialize(context, { isJSON: true })};
          window.__COMPONENT_PATH__ = ${serialize(viewPath, { isJSON: true })};
        </script>
      `;

      // Inject client script and styles
      let clientScript = '';
      let styles = '';

      if (this.vite) {
        // Development: Use Vite's direct module loading with HMR
        clientScript = `<script type="module" src="/src/view/entry-client.tsx"></script>`;
        // Inject CSS directly in development to prevent FOUC
        styles = `<link rel="stylesheet" href="/src/view/styles/globals.css" />`;
      } else {
        // Production: Use manifest to get hashed filename
        if (this.manifest && this.manifest['src/view/entry-client.tsx']) {
          const entryFile = this.manifest['src/view/entry-client.tsx'].file;
          clientScript = `<script type="module" src="/${entryFile}"></script>`;

          // Inject CSS from manifest
          if (this.manifest['src/view/entry-client.tsx'].css) {
            const cssFiles = this.manifest['src/view/entry-client.tsx'].css;
            styles = cssFiles.map(css => `<link rel="stylesheet" href="/${css}" />`).join('\n    ');
          }
        } else {
          this.logger.error('⚠️  Client entry not found in manifest');
          clientScript = `<script type="module" src="/assets/client.js"></script>`;
        }
      }

      // Generate head tags
      const headTags = this.templateParser.buildHeadTags(head);

      // Replace placeholders
      let html = template.replace('<!--app-html-->', appHtml);
      html = html.replace('<!--initial-state-->', initialStateScript);
      html = html.replace('<!--client-scripts-->', clientScript);
      html = html.replace('<!--styles-->', styles);
      html = html.replace('<!--head-meta-->', headTags);

      // Log performance metrics in development
      if (this.isDevelopment) {
        const duration = Date.now() - startTime;
        this.logger.log(
          `[SSR] ${viewPath} rendered in ${duration}ms (string mode)`,
        );
      }

      return html;
    } catch (error) {
      // Re-throw error - let NestJS exception layer handle it
      throw error;
    }
  }

  /**
   * Modern streaming SSR using renderToPipeableStream
   */
  private async renderToStream(
    viewPath: string,
    data: any = {},
    res: Response,
    head?: HeadData,
  ): Promise<void> {
    const startTime = Date.now();
    let shellReadyTime = 0;

    try {
      let template = this.template;

      // In development, transform the template with Vite
      if (this.vite) {
        template = await this.vite.transformIndexHtml('/', template);
      }

      // Parse template into parts
      const templateParts = this.templateParser.parseTemplate(template);

      // Import and use the SSR render function
      let renderModule;
      if (this.vite) {
        // Development: Use Vite's SSR loading with HMR support
        renderModule = await this.vite.ssrLoadModule(
          '/src/view/entry-server.tsx',
        );
      } else {
        // Production: Import the built server bundle using manifest
        if (
          this.serverManifest &&
          this.serverManifest['src/view/entry-server.tsx']
        ) {
          const serverFile =
            this.serverManifest['src/view/entry-server.tsx'].file;
          const serverPath = join(process.cwd(), 'dist/server', serverFile);
          renderModule = await import(serverPath);
        } else {
          throw new Error(
            'Server bundle not found in manifest. Run `pnpm build:server` to generate the server bundle.',
          );
        }
      }

      // Extract data and context
      const { data: pageData, __context: context } = data;

      // Build inline scripts
      const inlineScripts = this.templateParser.buildInlineScripts(
        pageData,
        context,
        viewPath,
      );

      // Get client script tag
      const clientScript = this.templateParser.getClientScriptTag(
        this.isDevelopment,
        this.manifest,
      );

      // Get stylesheet tags
      const stylesheetTags = this.templateParser.getStylesheetTags(
        this.isDevelopment,
        this.manifest,
      );

      // Generate head tags
      const headTags = this.templateParser.buildHeadTags(head);

      // Set up streaming with error handlers
      let didError = false;

      const { pipe, abort } = renderModule.renderComponentStream(
        viewPath,
        data,
        {
          onShellReady: () => {
            // Shell is ready - start streaming
            shellReadyTime = Date.now();
            res.statusCode = didError ? 500 : 200;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');

            // Write HTML start with styles and head meta injected
            let htmlStart = templateParts.htmlStart;
            htmlStart = htmlStart.replace('<!--styles-->', stylesheetTags);
            htmlStart = htmlStart.replace('<!--head-meta-->', headTags);
            res.write(htmlStart);

            // Write root div start
            res.write(templateParts.rootStart);

            // Pipe React stream to response
            pipe(res as unknown as Writable);

            // Log TTFB (Time to First Byte) in development
            if (this.isDevelopment) {
              const ttfb = shellReadyTime - startTime;
              this.logger.log(
                `[SSR] ${viewPath} shell ready in ${ttfb}ms (stream mode - TTFB)`,
              );
            }
          },

          onShellError: (error: Error) => {
            // Error before shell ready - can still send error page
            this.streamingErrorHandler.handleShellError(
              error,
              res,
              viewPath,
              this.isDevelopment,
            );
          },

          onError: (error: Error) => {
            // Error during streaming - headers already sent
            didError = true;
            this.streamingErrorHandler.handleStreamError(error, viewPath);
          },

          onAllReady: () => {
            // All content ready (including Suspense)
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

            // Log total streaming time in development
            if (this.isDevelopment) {
              const totalTime = Date.now() - startTime;
              const streamTime = Date.now() - shellReadyTime;
              this.logger.log(
                `[SSR] ${viewPath} streaming complete in ${totalTime}ms total (${streamTime}ms streaming)`,
              );
            }
          },
        },
      );

      // Handle client disconnection
      res.on('close', () => {
        abort();
      });
    } catch (error) {
      // Handle error before streaming started
      this.streamingErrorHandler.handleShellError(
        error as Error,
        res,
        viewPath,
        this.isDevelopment,
      );
    }
  }
}
