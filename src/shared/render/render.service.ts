import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import serialize from 'serialize-javascript';
import type { ViteDevServer } from 'vite';
import type { Response } from 'express';
import { Writable } from 'stream';
import { ERROR_REPORTER } from '../monitoring/constants';
import type { ErrorReporter } from '../monitoring/interfaces';
import type { SSRMode } from './interfaces';
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
    @Inject(ERROR_REPORTER) private readonly errorReporter: ErrorReporter,
    private readonly templateParser: TemplateParserService,
    private readonly streamingErrorHandler: StreamingErrorHandler,
    @Optional() @Inject('SSR_MODE') ssrMode?: SSRMode,
  ) {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.ssrMode = ssrMode || (process.env.SSR_MODE as SSRMode) || 'string';

    // Load HTML template
    const templatePath = this.isDevelopment
      ? join(process.cwd(), 'src/view/template.html')
      : join(process.cwd(), 'dist/client/template.html');

    this.template = readFileSync(templatePath, 'utf-8');

    // In production, load the Vite manifests to get hashed filenames
    if (!this.isDevelopment) {
      // Load client manifest
      const manifestPath = join(process.cwd(), 'dist/client/.vite/manifest.json');
      if (existsSync(manifestPath)) {
        this.manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      } else {
        this.logger.warn('⚠️  Client manifest not found. Run `pnpm build:client` first.');
      }

      // Load server manifest
      const serverManifestPath = join(process.cwd(), 'dist/server/.vite/manifest.json');
      if (existsSync(serverManifestPath)) {
        this.serverManifest = JSON.parse(readFileSync(serverManifestPath, 'utf-8'));
      } else {
        this.logger.warn('⚠️  Server manifest not found. Run `pnpm build:server` first.');
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
  ): Promise<string | void> {
    if (this.ssrMode === 'stream') {
      if (!res) {
        throw new Error(
          'Response object is required for streaming SSR mode. Pass res as third parameter.',
        );
      }
      return this.renderToStream(viewPath, data, res);
    }
    return this.renderToString(viewPath, data);
  }

  /**
   * Traditional string-based SSR using renderToString
   */
  private async renderToString(viewPath: string, data: any = {}): Promise<string> {
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
        renderModule = await this.vite.ssrLoadModule('/src/view/entry-server.tsx');
      } else {
        // Production: Import the built server bundle using manifest
        if (this.serverManifest && this.serverManifest['src/view/entry-server.tsx']) {
          const serverFile = this.serverManifest['src/view/entry-server.tsx'].file;
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

      // Inject client script
      let clientScript = '';
      if (this.vite) {
        // Development: Use Vite's direct module loading
        clientScript = `<script type="module" src="/src/view/entry-client.tsx"></script>`;
      } else {
        // Production: Use manifest to get hashed filename
        if (this.manifest && this.manifest['src/view/entry-client.tsx']) {
          const entryFile = this.manifest['src/view/entry-client.tsx'].file;
          clientScript = `<script type="module" src="/${entryFile}"></script>`;
        } else {
          this.logger.error('⚠️  Client entry not found in manifest');
          clientScript = `<script type="module" src="/assets/client.js"></script>`;
        }
      }

      // Replace placeholders
      let html = template.replace('<!--app-html-->', appHtml);
      html = html.replace('<!--initial-state-->', initialStateScript);
      html = html.replace('<!--client-scripts-->', clientScript);

      return html;
    } catch (error) {
      // Report error with context
      this.errorReporter.reportError(error as Error, {
        viewPath,
        componentPath: viewPath,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
      });
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
  ): Promise<void> {
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
        renderModule = await this.vite.ssrLoadModule('/src/view/entry-server.tsx');
      } else {
        // Production: Import the built server bundle using manifest
        if (this.serverManifest && this.serverManifest['src/view/entry-server.tsx']) {
          const serverFile = this.serverManifest['src/view/entry-server.tsx'].file;
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

      // Set up streaming with error handlers
      let didError = false;

      const { pipe, abort } = renderModule.renderComponentStream(viewPath, data, {
        onShellReady: () => {
          // Shell is ready - start streaming
          res.statusCode = didError ? 500 : 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');

          // Write HTML start
          res.write(templateParts.htmlStart);

          // Write root div start
          res.write(templateParts.rootStart);

          // Pipe React stream to response
          pipe(res as unknown as Writable);
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
        },
      });

      // Handle client disconnection
      res.on('close', () => {
        abort();
      });
    } catch (error) {
      // Report error with context
      this.errorReporter.reportError(error as Error, {
        viewPath,
        componentPath: viewPath,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
      });

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
