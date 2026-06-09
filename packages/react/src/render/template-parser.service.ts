import { Injectable, Logger } from '@nestjs/common';
import { uneval } from 'devalue';
import escapeHtml from 'escape-html';
import type { TemplateParts, HeadData } from '../interfaces';
import { serializeLayoutMetadata } from './component-name.util';

/**
 * Valid HTML attribute names for custom head tags.
 * Restrictive on purpose: attribute names are interpolated into markup raw,
 * so anything outside this set is rejected to prevent markup injection.
 */
const VALID_ATTRIBUTE_NAME = /^[a-zA-Z][a-zA-Z0-9:_-]*$/;

interface ViteManifestEntry {
  file: string;
  src?: string;
  isEntry?: boolean;
  imports?: string[];
  css?: string[];
}

interface ViteManifest {
  [key: string]: ViteManifestEntry;
}

/**
 * Service for parsing HTML templates and building inline scripts for SSR
 */
@Injectable()
export class TemplateParserService {
  private readonly logger = new Logger(TemplateParserService.name);

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
   * Safely serializes data using devalue to avoid XSS vulnerabilities.
   * Devalue is designed specifically for SSR, handling complex types safely
   * while being faster and more secure than alternatives.
   *
   * @param nonce - Optional CSP nonce added to the script tag so the inline
   *   script can run under a strict Content-Security-Policy.
   */
  buildInlineScripts(
    data: any,
    context: any,
    componentName: string,
    layouts?: Array<{ layout: any; props?: any }>,
    nonce?: string,
  ): string {
    // Serialize layout metadata (names and props, not functions)
    const layoutMetadata = serializeLayoutMetadata(layouts);

    // Use devalue for consistent, secure serialization
    // Same approach used in string mode for consistency across rendering modes
    return `<script${this.nonceAttribute(nonce)}>
window.__INITIAL_STATE__ = ${uneval(data)};
window.__CONTEXT__ = ${uneval(context)};
window.__COMPONENT_NAME__ = ${uneval(componentName)};
window.__LAYOUTS__ = ${uneval(layoutMetadata)};
</script>`;
  }

  /**
   * Get client script tag for hydration
   *
   * In development: Direct module import with Vite HMR
   * In production: Hashed filename from manifest
   */
  getClientScriptTag(
    isDevelopment: boolean,
    manifest?: ViteManifest | null,
    nonce?: string,
  ): string {
    const nonceAttr = this.nonceAttribute(nonce);

    if (isDevelopment) {
      return `<script type="module"${nonceAttr} src="/src/views/entry-client.tsx"></script>`;
    }

    const entry = this.findClientEntry(manifest);
    if (!entry) {
      throw new Error('Manifest missing entry for src/views/entry-client.tsx');
    }

    return `<script type="module"${nonceAttr} src="/${entry.file}"></script>`;
  }

  /**
   * Get stylesheet link tags
   *
   * In development: Direct link to source CSS file
   * In production: Hashed CSS files from manifest
   */
  getStylesheetTags(
    isDevelopment: boolean,
    manifest?: ViteManifest | null,
  ): string {
    if (isDevelopment) {
      return '';
    }

    const entry = this.findClientEntry(manifest);
    if (!entry?.css?.length) {
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
   * Locate the client entry in the Vite manifest.
   *
   * Single source of truth for both rendering modes: prefer any entry chunk
   * whose key contains "entry-client" (covers custom project layouts), then
   * fall back to the conventional exact key.
   */
  private findClientEntry(
    manifest?: ViteManifest | null,
  ): ViteManifestEntry | null {
    if (!manifest) {
      return null;
    }

    const entryChunk = Object.entries(manifest).find(
      ([key, value]) => value.isEntry && key.includes('entry-client'),
    );
    if (entryChunk) {
      return entryChunk[1];
    }

    return manifest['src/views/entry-client.tsx'] ?? null;
  }

  private nonceAttribute(nonce?: string): string {
    return nonce ? ` nonce="${escapeHtml(nonce)}"` : '';
  }

  /**
   * Build an HTML tag from an object of attributes.
   *
   * Attribute values are HTML-escaped; attribute names cannot be escaped, so
   * names that are not valid HTML attribute identifiers are rejected.
   */
  private buildTag(tagName: string, attrs: Record<string, any>): string {
    const attrString = Object.entries(attrs)
      .filter(([key]) => {
        if (VALID_ATTRIBUTE_NAME.test(key)) {
          return true;
        }
        this.logger.warn(
          `Skipping invalid attribute name "${key}" on <${tagName}> head tag`,
        );
        return false;
      })
      .map(([key, value]) => `${key}="${escapeHtml(String(value))}"`)
      .join(' ');
    return `<${tagName} ${attrString} />`;
  }
}
