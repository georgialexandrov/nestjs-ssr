import { Injectable } from '@nestjs/common';
import serialize from 'serialize-javascript';
import type { TemplateParts, HeadData } from '../interfaces';

/**
 * Service for parsing HTML templates and building inline scripts for SSR
 */
@Injectable()
export class TemplateParserService {
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
  buildInlineScripts(
    data: any,
    context: any,
    componentPath: string,
  ): string {
    // Use serialize-javascript with isJSON flag for consistent, secure serialization
    // Same approach used in string mode for consistency across rendering modes
    return `<script>
window.__INITIAL_STATE__ = ${serialize(data, { isJSON: true })};
window.__CONTEXT__ = ${serialize(context, { isJSON: true })};
window.__COMPONENT_PATH__ = ${serialize(componentPath, { isJSON: true })};
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
      return '<script type="module" src="/src/view/entry-client.tsx"></script>';
    }

    if (!manifest || !manifest['src/view/entry-client.tsx']) {
      throw new Error(
        'Manifest missing entry for src/view/entry-client.tsx',
      );
    }

    const entryFile = manifest['src/view/entry-client.tsx'].file;
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
      return '<link rel="stylesheet" href="/src/view/styles/globals.css" />';
    }

    if (!manifest || !manifest['src/view/entry-client.tsx']) {
      return '';
    }

    const entry = manifest['src/view/entry-client.tsx'];
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
   * Safely escapes content to prevent XSS.
   */
  buildHeadTags(head?: HeadData): string {
    if (!head) {
      return '';
    }

    const tags: string[] = [];

    // Title tag
    if (head.title) {
      const escapedTitle = this.escapeHtml(head.title);
      tags.push(`<title>${escapedTitle}</title>`);
    }

    // Description meta tag
    if (head.description) {
      const escapedDesc = this.escapeHtml(head.description);
      tags.push(
        `<meta name="description" content="${escapedDesc}" />`,
      );
    }

    // Keywords meta tag
    if (head.keywords) {
      const escapedKeywords = this.escapeHtml(head.keywords);
      tags.push(
        `<meta name="keywords" content="${escapedKeywords}" />`,
      );
    }

    // Canonical link
    if (head.canonical) {
      const escapedCanonical = this.escapeHtml(head.canonical);
      tags.push(
        `<link rel="canonical" href="${escapedCanonical}" />`,
      );
    }

    // Open Graph tags
    if (head.ogTitle) {
      const escapedOgTitle = this.escapeHtml(head.ogTitle);
      tags.push(
        `<meta property="og:title" content="${escapedOgTitle}" />`,
      );
    }

    if (head.ogDescription) {
      const escapedOgDesc = this.escapeHtml(head.ogDescription);
      tags.push(
        `<meta property="og:description" content="${escapedOgDesc}" />`,
      );
    }

    if (head.ogImage) {
      const escapedOgImage = this.escapeHtml(head.ogImage);
      tags.push(
        `<meta property="og:image" content="${escapedOgImage}" />`,
      );
    }

    // Custom link tags (fonts, icons, preloads, etc.)
    if (head.links && Array.isArray(head.links)) {
      for (const link of head.links) {
        const attrs = Object.entries(link)
          .map(([key, value]) => {
            const escapedValue = this.escapeHtml(String(value));
            return `${key}="${escapedValue}"`;
          })
          .join(' ');
        tags.push(`<link ${attrs} />`);
      }
    }

    // Custom meta tags
    if (head.meta && Array.isArray(head.meta)) {
      for (const meta of head.meta) {
        const attrs = Object.entries(meta)
          .map(([key, value]) => {
            const escapedValue = this.escapeHtml(String(value));
            return `${key}="${escapedValue}"`;
          })
          .join(' ');
        tags.push(`<meta ${attrs} />`);
      }
    }

    return tags.join('\n    ');
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
