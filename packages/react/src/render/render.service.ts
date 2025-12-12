import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { uneval } from 'devalue';
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
  private readonly entryServerPath: string;
  private rootLayout: any | null | undefined = undefined; // undefined = not checked, null = doesn't exist, any = loaded
  private rootLayoutChecked = false;

  constructor(
    private readonly templateParser: TemplateParserService,
    private readonly streamingErrorHandler: StreamingErrorHandler,
    @Optional() @Inject('SSR_MODE') ssrMode?: SSRMode,
    @Optional() @Inject('DEFAULT_HEAD') private readonly defaultHead?: HeadData,
    @Optional() @Inject('CUSTOM_TEMPLATE') customTemplate?: string,
  ) {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.ssrMode = ssrMode || (process.env.SSR_MODE as SSRMode) || 'string';

    // Resolve entry-server.tsx path for Vite
    // Get absolute path to the template file
    const absoluteServerPath = join(__dirname, '/templates/entry-server.tsx');
    // Convert to path relative to app root
    const relativeServerPath = relative(process.cwd(), absoluteServerPath);

    // If path goes outside app root (starts with ..), use absolute path
    // Otherwise use app-relative path with / prefix
    if (relativeServerPath.startsWith('..')) {
      this.entryServerPath = absoluteServerPath;
    } else {
      this.entryServerPath = '/' + relativeServerPath.replace(/\\/g, '/');
    }

    // Load HTML template
    // Priority: 1) Custom template, 2) Package template, 3) Local template
    if (customTemplate) {
      // Custom template provided - check if it's a file path or template string
      if (
        customTemplate.includes('<!DOCTYPE') ||
        customTemplate.includes('<html')
      ) {
        // Looks like a template string
        this.template = customTemplate;
        this.logger.log(`✓ Loaded custom template (inline)`);
      } else {
        // Treat as file path (absolute or relative to cwd)
        const customTemplatePath = customTemplate.startsWith('/')
          ? customTemplate
          : join(process.cwd(), customTemplate);

        if (!existsSync(customTemplatePath)) {
          throw new Error(
            `Custom template file not found at ${customTemplatePath}`,
          );
        }

        try {
          this.template = readFileSync(customTemplatePath, 'utf-8');
          this.logger.log(
            `✓ Loaded custom template from ${customTemplatePath}`,
          );
        } catch (error: any) {
          throw new Error(
            `Failed to read custom template file at ${customTemplatePath}: ${error.message}`,
          );
        }
      }
    } else {
      // No custom template - use default package template
      let templatePath: string;

      if (this.isDevelopment) {
        // In dev mode, try package templates (both source and built), then fall back to local
        const packageTemplatePaths = [
          join(__dirname, '../templates/index.html'), // From dist/render -> dist/templates (built package)
          join(__dirname, '../src/templates/index.html'), // From render/ -> src/templates (dev with ts-node)
          join(__dirname, '../../src/templates/index.html'), // Alternative: from dist/render -> src/templates
        ];
        const localTemplatePath = join(process.cwd(), 'src/views/index.html');

        const foundPackageTemplate = packageTemplatePaths.find((p) =>
          existsSync(p),
        );

        if (foundPackageTemplate) {
          templatePath = foundPackageTemplate;
        } else if (existsSync(localTemplatePath)) {
          templatePath = localTemplatePath;
        } else {
          throw new Error(
            `Template file not found. Tried:\n` +
              packageTemplatePaths
                .map((p) => `  - ${p} (package template)`)
                .join('\n') +
              `\n` +
              `  - ${localTemplatePath} (local template)`,
          );
        }
      } else {
        templatePath = join(process.cwd(), 'dist/client/index.html');

        if (!existsSync(templatePath)) {
          throw new Error(
            `Template file not found at ${templatePath}. ` +
              `Make sure to run the build process first.`,
          );
        }
      }

      try {
        this.template = readFileSync(templatePath, 'utf-8');
        this.logger.log(`✓ Loaded template from ${templatePath}`);
      } catch (error: any) {
        throw new Error(
          `Failed to read template file at ${templatePath}: ${error.message}`,
        );
      }
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
   * Get the root layout component if it exists
   * Auto-discovers layout files at conventional paths:
   * - src/views/layout.tsx
   * - src/views/layout/index.tsx
   * - src/views/_layout.tsx
   */
  async getRootLayout(): Promise<any | null> {
    // Return cached result if already checked
    if (this.rootLayoutChecked) {
      return this.rootLayout;
    }

    // Mark as checked to avoid repeated attempts
    this.rootLayoutChecked = true;

    const conventionalPaths = [
      'src/views/layout.tsx',
      'src/views/layout/index.tsx',
      'src/views/_layout.tsx',
    ];

    try {
      for (const path of conventionalPaths) {
        const absolutePath = join(process.cwd(), path);

        // Check if file exists
        if (!existsSync(absolutePath)) {
          continue;
        }

        this.logger.log(`✓ Found root layout at ${path}`);

        // Load the layout component
        if (this.vite) {
          // Development: Use Vite's SSR loading
          const layoutModule = await this.vite.ssrLoadModule('/' + path);
          this.rootLayout = layoutModule.default;
          return this.rootLayout;
        } else {
          // Production: Use regular import (already built)
          // In production, the layout would be in dist/server/
          const prodPath = path
            .replace('src/views', 'dist/server/views')
            .replace('.tsx', '.js');
          const absoluteProdPath = join(process.cwd(), prodPath);

          if (existsSync(absoluteProdPath)) {
            const layoutModule = await import(absoluteProdPath);
            this.rootLayout = layoutModule.default;
            return this.rootLayout;
          }
        }
      }

      // No root layout found, return null
      this.rootLayout = null;
      return null;
    } catch (error: any) {
      this.logger.warn(`⚠️  Error loading root layout: ${error.message}`);
      this.rootLayout = null;
      return null;
    }
  }

  /**
   * Main render method that routes to string or stream mode
   */
  async render(
    viewComponent: any,
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
      return this.renderToStream(viewComponent, data, res, mergedHead);
    }
    return this.renderToString(viewComponent, data, mergedHead);
  }

  /**
   * Merge default head with page-specific head
   * Page-specific head values override defaults
   */
  private mergeHead(
    defaultHead?: HeadData,
    pageHead?: HeadData,
  ): HeadData | undefined {
    if (!defaultHead && !pageHead) {
      return undefined;
    }

    return {
      ...defaultHead,
      ...pageHead,
      // Merge arrays (links and meta) instead of replacing
      links: [...(defaultHead?.links || []), ...(pageHead?.links || [])],
      meta: [...(defaultHead?.meta || []), ...(pageHead?.meta || [])],
    };
  }

  /**
   * Traditional string-based SSR using renderToString
   */
  private async renderToString(
    viewComponent: any,
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
        // Development: Use Vite's SSR loading with HMR support from package template
        renderModule = await this.vite.ssrLoadModule(this.entryServerPath);
      } else {
        // Production: Import the built server bundle using manifest
        if (this.serverManifest) {
          // Find the entry file in the manifest (supports both old and new paths)
          const manifestEntry = Object.entries(this.serverManifest).find(
            ([key, value]: [string, any]) =>
              value.isEntry && key.includes('entry-server'),
          );

          if (manifestEntry) {
            const [, entry] = manifestEntry;
            const serverPath = join(process.cwd(), 'dist/server', entry.file);
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
      const { data: pageData, __context: context, __layouts: layouts } = data;

      // Render the React component (pass component directly)
      const appHtml = await renderModule.renderComponent(viewComponent, data);

      // Get component name for client-side hydration
      const componentName =
        viewComponent.displayName || viewComponent.name || 'Component';

      // Serialize layout metadata (names and props, not functions)
      const layoutMetadata = layouts
        ? layouts.map((l: any) => ({
            name: l.layout.displayName || l.layout.name || 'default',
            props: l.props,
          }))
        : [];

      // Serialize initial state, context, and layouts for client
      const initialStateScript = `
        <script>
          window.__INITIAL_STATE__ = ${uneval(pageData)};
          window.__CONTEXT__ = ${uneval(context)};
          window.__COMPONENT_NAME__ = ${uneval(componentName)};
          window.__LAYOUTS__ = ${uneval(layoutMetadata)};
        </script>
      `;

      // Inject client script and styles
      let clientScript = '';
      let styles = '';

      if (this.vite) {
        // Development: Use app's local entry-client in views directory
        clientScript = `<script type="module" src="/src/views/entry-client.tsx"></script>`;
        // Note: CSS is handled by Vite in dev mode via @vitejs/plugin-react
        styles = '';
      } else {
        // Production: Use manifest to get hashed filename
        if (this.manifest) {
          // Find the entry file in the manifest (supports both old and new paths)
          const manifestEntry = Object.entries(this.manifest).find(
            ([key, value]: [string, any]) =>
              value.isEntry && key.includes('entry-client'),
          );

          if (manifestEntry) {
            const [, entry] = manifestEntry;
            const entryFile = entry.file;
            clientScript = `<script type="module" src="/${entryFile}"></script>`;

            // Inject CSS from manifest
            if (entry.css) {
              const cssFiles = entry.css;
              styles = cssFiles
                .map((css) => `<link rel="stylesheet" href="/${css}" />`)
                .join('\n    ');
            }
          } else {
            this.logger.error('⚠️  Client entry not found in manifest');
            clientScript = `<script type="module" src="/assets/client.js"></script>`;
          }
        } else {
          this.logger.error('⚠️  Client manifest not found');
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
        const componentName =
          typeof viewComponent === 'function'
            ? viewComponent.name
            : String(viewComponent);
        this.logger.log(
          `[SSR] ${componentName} rendered in ${duration}ms (string mode)`,
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
    viewComponent: any,
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
        // Development: Use Vite's SSR loading with HMR support from package template
        renderModule = await this.vite.ssrLoadModule(this.entryServerPath);
      } else {
        // Production: Import the built server bundle using manifest
        if (this.serverManifest) {
          // Find the entry file in the manifest (supports both old and new paths)
          const manifestEntry = Object.entries(this.serverManifest).find(
            ([key, value]: [string, any]) =>
              value.isEntry && key.includes('entry-server'),
          );

          if (manifestEntry) {
            const [, entry] = manifestEntry;
            const serverPath = join(process.cwd(), 'dist/server', entry.file);
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
      const { data: pageData, __context: context, __layouts: layouts } = data;

      // Get component name for client-side hydration and logging
      const componentName =
        viewComponent.displayName || viewComponent.name || 'Component';

      // Build inline scripts (including layout metadata)
      const inlineScripts = this.templateParser.buildInlineScripts(
        pageData,
        context,
        componentName,
        layouts,
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
        viewComponent,
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
                `[SSR] ${componentName} shell ready in ${ttfb}ms (stream mode - TTFB)`,
              );
            }
          },

          onShellError: (error: Error) => {
            // Error before shell ready - can still send error page
            this.streamingErrorHandler.handleShellError(
              error,
              res,
              componentName,
              this.isDevelopment,
            );
          },

          onError: (error: Error) => {
            // Error during streaming - headers already sent
            didError = true;
            this.streamingErrorHandler.handleStreamError(error, componentName);
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
                `[SSR] ${componentName} streaming complete in ${totalTime}ms total (${streamTime}ms streaming)`,
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
      const componentName =
        typeof viewComponent === 'function'
          ? viewComponent.name
          : String(viewComponent);
      this.streamingErrorHandler.handleShellError(
        error as Error,
        res,
        componentName,
        this.isDevelopment,
      );
    }
  }
}
