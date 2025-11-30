import { Injectable } from '@nestjs/common';
import type { TemplateParts } from './interfaces';

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
   * Safely serializes data to avoid XSS vulnerabilities
   */
  buildInlineScripts(
    data: any,
    context: any,
    componentPath: string,
  ): string {
    // Use JSON.stringify with replacer to safely serialize
    // This prevents XSS by escaping < > & characters
    const dataJson = this.safeSerialize(data);
    const contextJson = this.safeSerialize(context);
    const pathJson = this.safeSerialize(componentPath);

    return `<script>
window.__INITIAL_STATE__ = ${dataJson};
window.__CONTEXT__ = ${contextJson};
window.__COMPONENT_PATH__ = ${pathJson};
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
   * Safely serialize data to JSON with XSS protection
   *
   * Escapes characters that could break out of <script> tags
   */
  private safeSerialize(data: any): string {
    return JSON.stringify(data)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028') // Line separator
      .replace(/\u2029/g, '\\u2029'); // Paragraph separator
  }
}
