import { Injectable, Logger } from '@nestjs/common';
import { uneval } from 'devalue';
import type { ViteDevServer } from 'vite';
import type { HeadData, SegmentResponse } from '../../interfaces';
import { TemplateParserService } from '../template-parser.service';

interface ViteManifest {
  [key: string]: {
    file: string;
    src?: string;
    isEntry?: boolean;
    imports?: string[];
    css?: string[];
  };
}

export interface StringRenderContext {
  template: string;
  vite: ViteDevServer | null;
  manifest: ViteManifest | null;
  serverManifest: ViteManifest | null;
  entryServerPath: string;
  isDevelopment: boolean;
}

/**
 * String-based SSR renderer using React's renderToString
 *
 * This is the default renderer that provides:
 * - Atomic responses (complete HTML or error page)
 * - Proper HTTP status codes
 * - Simple error handling
 * - Easy debugging
 */
@Injectable()
export class StringRenderer {
  private readonly logger = new Logger(StringRenderer.name);

  constructor(private readonly templateParser: TemplateParserService) {}

  /**
   * Render a React component to a complete HTML string
   */
  async render(
    viewComponent: any,
    data: any,
    context: StringRenderContext,
    head?: HeadData,
  ): Promise<string> {
    const startTime = Date.now();

    let template = context.template;

    // In development, transform the template with Vite
    if (context.vite) {
      template = await context.vite.transformIndexHtml('/', template);
    }

    // Import and use the SSR render function
    let renderModule;
    if (context.vite) {
      // Development: Use Vite's SSR loading with HMR support from package template
      renderModule = await context.vite.ssrLoadModule(context.entryServerPath);
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
    const { data: pageData, __context: pageContext, __layouts: layouts } = data;

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
          window.__CONTEXT__ = ${uneval(pageContext)};
          window.__COMPONENT_NAME__ = ${uneval(componentName)};
          window.__LAYOUTS__ = ${uneval(layoutMetadata)};
        </script>
      `;

    // Inject client script and styles
    let clientScript = '';
    let styles = '';

    if (context.vite) {
      // Development: Use app's local entry-client in views directory
      clientScript = `<script type="module" src="/src/views/entry-client.tsx"></script>`;
    } else {
      // Production: Use manifest to get hashed filename
      if (context.manifest) {
        // Find the entry file in the manifest (supports both old and new paths)
        const manifestEntry = Object.entries(context.manifest).find(
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
    if (context.isDevelopment) {
      const duration = Date.now() - startTime;
      const name =
        typeof viewComponent === 'function'
          ? viewComponent.name
          : String(viewComponent);
      this.logger.log(`[SSR] ${name} rendered in ${duration}ms (string mode)`);
    }

    return html;
  }

  /**
   * Render a segment for client-side navigation.
   * Returns just the HTML and metadata without the full page template.
   */
  async renderSegment(
    viewComponent: any,
    data: any,
    context: StringRenderContext,
    swapTarget: string,
    head?: HeadData,
  ): Promise<SegmentResponse> {
    const startTime = Date.now();

    // Import the SSR render function
    let renderModule;
    if (context.vite) {
      renderModule = await context.vite.ssrLoadModule(context.entryServerPath);
    } else {
      if (context.serverManifest) {
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

    // Extract page data and context
    const { data: pageData, __context: pageContext } = data;

    // Render the React component to HTML
    const html = await renderModule.renderComponent(viewComponent, data);

    // Get component name for client-side hydration
    const componentName =
      viewComponent.displayName || viewComponent.name || 'Component';

    // Log performance metrics in development
    if (context.isDevelopment) {
      const duration = Date.now() - startTime;
      this.logger.log(
        `[SSR] ${componentName} segment rendered in ${duration}ms`,
      );
    }

    return {
      html,
      head,
      props: pageData,
      swapTarget,
      componentName,
      context: pageContext,
    };
  }
}
