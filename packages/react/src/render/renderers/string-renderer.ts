import { Injectable, Logger } from '@nestjs/common';
import type { HeadData, SegmentResponse } from '../../interfaces';
import { TemplateParserService } from '../template-parser.service';
import {
  loadServerModule,
  type RendererContext,
} from '../server-module-loader';
import {
  getComponentName,
  serializeLayoutMetadata,
} from '../component-name.util';
import { injectPlaceholder } from '../template.util';

export type StringRenderContext = RendererContext;

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

    const renderModule = await loadServerModule(context);

    const { data: pageData, __context: pageContext, __layouts: layouts } = data;

    // Render the React component (pass component directly)
    const appHtml = await renderModule.renderComponent(viewComponent, data);

    const componentName = getComponentName(viewComponent);

    // Serialize initial state, context, and layouts for client hydration
    const initialStateScript = this.templateParser.buildInlineScripts(
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

    const styles = this.templateParser.getStylesheetTags(
      useDevAssets,
      context.manifest,
    );

    const headTags = this.templateParser.buildHeadTags(head);

    let html = injectPlaceholder(template, '<!--app-html-->', appHtml);
    html = injectPlaceholder(html, '<!--initial-state-->', initialStateScript);
    html = injectPlaceholder(html, '<!--client-scripts-->', clientScript);
    html = injectPlaceholder(html, '<!--styles-->', styles);
    html = injectPlaceholder(html, '<!--head-meta-->', headTags);

    // Log performance metrics in development
    if (context.isDevelopment) {
      const duration = Date.now() - startTime;
      this.logger.log(
        `[SSR] ${componentName} rendered in ${duration}ms (string mode)`,
      );
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

    const renderModule = await loadServerModule(context);

    // Extract page data, context, and layouts (filtered to those below swap target)
    const { data: pageData, __context: pageContext, __layouts: layouts } = data;

    // Render the segment with its layouts (layouts below swap target)
    const html = await renderModule.renderSegment(viewComponent, data);

    const componentName = getComponentName(viewComponent);
    const layoutMetadata = serializeLayoutMetadata(layouts);

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
      layouts: layoutMetadata,
    };
  }
}
