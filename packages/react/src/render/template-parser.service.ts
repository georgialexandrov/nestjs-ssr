import { Injectable } from '@nestjs/common';
import serialize from 'serialize-javascript';
import escapeHtml from 'escape-html';
import type { TemplateParts, HeadData } from '../interfaces';

/**
 * Service for parsing HTML templates and building inline scripts for SSR
 */
@Injectable()
export class TemplateParserService {
  // Mapping of HeadData fields to their HTML tag renderers
  // Order matters: title and description first for SEO best practices
  private readonly headTagRenderers = [
    {
      key: 'title' as const,
      render: (v: string) => `<title>${escapeHtml(v)}</title>`,
    },
    {
      key: 'description' as const,
      render: (v: string) =>
        `<meta name="description" content="${escapeHtml(v)}" />`,
    },
    {
      key: 'keywords' as const,
      render: (v: string) =>
        `<meta name="keywords" content="${escapeHtml(v)}" />`,
    },
    {
      key: 'canonical' as const,
      render: (v: string) => `<link rel="canonical" href="${escapeHtml(v)}" />`,
    },
    {
      key: 'ogTitle' as const,
      render: (v: string) =>
        `<meta property="og:title" content="${escapeHtml(v)}" />`,
    },
    {
      key: 'ogDescription' as const,
      render: (v: string) =>
        `<meta property="og:description" content="${escapeHtml(v)}" />`,
    },
    {
      key: 'ogImage' as const,
      render: (v: string) =>
        `<meta property="og:image" content="${escapeHtml(v)}" />`,
    },
  ];
  /**
   * Parse HTML template into parts for streaming SSR
   *
   * Splits the template at strategic injection points:
   * - Before root div: Shell HTML (head, body start)
   * - Root div start
   * - Root div end
   * - After root: Scripts and closing tags
   */
  parseTemplate(html: string): TemplateParts {
    // Find the root div markers
    const rootStartMarker = '<div id="root">';
    const rootStartIndex = html.indexOf(rootStartMarker);

    if (rootStartIndex === -1) {
      throw new Error('Template must contain <div id="root">');
    }

    // Find the closing div (first </div> after root start)
    const commentMarker = '<!--app-html-->';
    const commentIndex = html.indexOf(commentMarker, rootStartIndex);

    if (commentIndex === -1) {
      throw new Error('Template must contain <!--app-html--> placeholder');
    }

    // Find the closing </div> after the comment
    const rootEndMarker = '</div>';
    const rootEndIndex = html.indexOf(rootEndMarker, commentIndex);

    if (rootEndIndex === -1) {
      throw new Error('Template must have closing </div> for root');
    }

    // Split template into parts
    const htmlStart = html.substring(0, rootStartIndex);
    const rootStart = rootStartMarker;
    const rootEnd = rootEndMarker;
    const htmlEnd = html.substring(rootEndIndex + rootEndMarker.length);

    return {
      htmlStart,
      rootStart,
      rootEnd,
      htmlEnd,
    };
  }

  /**
   * Build inline script that provides initial state to the client
   *
   * Safely serializes data using serialize-javascript to avoid XSS vulnerabilities.
   * This library handles all edge cases including escaping dangerous characters,
   * functions, dates, regexes, and prevents prototype pollution.
   */
  buildInlineScripts(data: any, context: any, componentName: string): string {
    // Use serialize-javascript with isJSON flag for consistent, secure serialization
    // Same approach used in string mode for consistency across rendering modes
    return `<script>
window.__INITIAL_STATE__ = ${serialize(data, { isJSON: true })};
window.__CONTEXT__ = ${serialize(context, { isJSON: true })};
window.__COMPONENT_NAME__ = ${serialize(componentName, { isJSON: true })};
</script>`;
  }

  /**
   * Get client script tag for hydration
   *
   * In development: Direct module import with Vite HMR
   * In production: Hashed filename from manifest
   */
  getClientScriptTag(isDevelopment: boolean, manifest?: any): string {
    if (isDevelopment) {
      return '<script type="module" src="/src/entry-client.tsx"></script>';
    }

    if (!manifest || !manifest['src/entry-client.tsx']) {
      throw new Error('Manifest missing entry for src/entry-client.tsx');
    }

    const entryFile = manifest['src/entry-client.tsx'].file;
    return `<script type="module" src="/${entryFile}"></script>`;
  }

  /**
   * Get stylesheet link tags
   *
   * In development: Direct link to source CSS file
   * In production: Hashed CSS files from manifest
   */
  getStylesheetTags(isDevelopment: boolean, manifest?: any): string {
    if (isDevelopment) {
      return '';
    }

    if (!manifest || !manifest['src/entry-client.tsx']) {
      return '';
    }

    const entry = manifest['src/entry-client.tsx'];
    if (!entry.css || entry.css.length === 0) {
      return '';
    }

    return entry.css
      .map((css: string) => `<link rel="stylesheet" href="/${css}" />`)
      .join('\n    ');
  }

  /**
   * Build HTML head tags from HeadData
   *
   * Generates title, meta tags, and link tags for SEO and page metadata.
   * Safely escapes content using escape-html to prevent XSS.
   */
  buildHeadTags(head?: HeadData): string {
    if (!head) {
      return '';
    }

    const tags: string[] = [];

    // Process predefined tags (title, description, OG tags, etc.)
    for (const { key, render } of this.headTagRenderers) {
      const value = head[key];
      if (value && typeof value === 'string') {
        tags.push(render(value));
      }
    }

    // Custom link tags (fonts, icons, preloads, etc.)
    if (head.links?.length) {
      tags.push(...head.links.map((link) => this.buildTag('link', link)));
    }

    // Custom meta tags
    if (head.meta?.length) {
      tags.push(...head.meta.map((meta) => this.buildTag('meta', meta)));
    }

    return tags.join('\n    ');
  }

  /**
   * Build an HTML tag from an object of attributes
   */
  private buildTag(tagName: string, attrs: Record<string, any>): string {
    const attrString = Object.entries(attrs)
      .map(([key, value]) => `${key}="${escapeHtml(String(value))}"`)
      .join(' ');
    return `<${tagName} ${attrString} />`;
  }
}
