import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateParserService } from '../template-parser.service';
import type { HeadData } from '../../interfaces';

describe('TemplateParserService', () => {
  let service: TemplateParserService;

  beforeEach(() => {
    service = new TemplateParserService();
  });

  describe('parseTemplate', () => {
    it('should parse valid HTML template into parts', () => {
      const html = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<div id="root"><!--app-html--></div>
<script src="/app.js"></script>
</body>
</html>
      `.trim();

      const result = service.parseTemplate(html);

      expect(result).toHaveProperty('htmlStart');
      expect(result).toHaveProperty('rootStart');
      expect(result).toHaveProperty('rootEnd');
      expect(result).toHaveProperty('htmlEnd');
      expect(result.rootStart).toBe('<div id="root">');
      expect(result.rootEnd).toBe('</div>');
      expect(result.htmlStart).toContain('<html>');
      expect(result.htmlEnd).toContain('</html>');
    });

    it('should throw error if root div is missing', () => {
      const html = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<div id="app"><!--app-html--></div>
</body>
</html>
      `.trim();

      expect(() => service.parseTemplate(html)).toThrow(
        'Template must contain <div id="root">',
      );
    });

    it('should throw error if app-html placeholder is missing', () => {
      const html = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<div id="root"></div>
</body>
</html>
      `.trim();

      expect(() => service.parseTemplate(html)).toThrow(
        'Template must contain <!--app-html--> placeholder',
      );
    });

    it('should throw error if closing div is missing', () => {
      const html = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<div id="root"><!--app-html-->
</body>
</html>
      `.trim();

      expect(() => service.parseTemplate(html)).toThrow(
        'Template must have closing </div> for root',
      );
    });
  });

  describe('buildInlineScripts', () => {
    it('should build inline scripts with serialized data', () => {
      const data = { message: 'Hello World', count: 42 };
      const context = { path: '/test', params: { id: '123' } };
      const componentPath = 'views/home';

      const result = service.buildInlineScripts(data, context, componentPath);

      expect(result).toContain('window.__INITIAL_STATE__');
      expect(result).toContain('window.__CONTEXT__');
      expect(result).toContain('window.__COMPONENT_PATH__');
      expect(result).toContain('"message":"Hello World"');
      expect(result).toContain('"count":42');
      // serialize-javascript escapes forward slashes as \u002F for XSS prevention
      expect(result).toContain('"path":"\\u002Ftest"');
      expect(result).toContain('"views\\u002Fhome"');
    });

    it('should safely serialize special characters', () => {
      const data = { script: '<script>alert("xss")</script>' };
      const context = {};
      const componentPath = 'views/test';

      const result = service.buildInlineScripts(data, context, componentPath);

      // serialize-javascript should escape dangerous characters
      expect(result).not.toContain('<script>alert');
      expect(result).toContain('\\u003C'); // Escaped <
    });

    it('should handle undefined and null values', () => {
      const data = { value: null, missing: undefined };
      const context = {};
      const componentPath = 'views/test';

      const result = service.buildInlineScripts(data, context, componentPath);

      expect(result).toContain('window.__INITIAL_STATE__');
      expect(result).toBeTruthy();
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: 'John',
          profile: {
            age: 30,
            settings: { theme: 'dark' },
          },
        },
      };
      const context = {};
      const componentPath = 'views/profile';

      const result = service.buildInlineScripts(data, context, componentPath);

      expect(result).toContain('"name":"John"');
      expect(result).toContain('"age":30');
      expect(result).toContain('"theme":"dark"');
    });
  });

  describe('getClientScriptTag', () => {
    it('should return development script tag in development mode', () => {
      const result = service.getClientScriptTag(true);

      expect(result).toBe(
        '<script type="module" src="/src/view/entry-client.tsx"></script>',
      );
    });

    it('should return production script tag with manifest', () => {
      const manifest = {
        'src/view/entry-client.tsx': {
          file: 'assets/entry-client-abc123.js',
        },
      };

      const result = service.getClientScriptTag(false, manifest);

      expect(result).toBe(
        '<script type="module" src="/assets/entry-client-abc123.js"></script>',
      );
    });

    it('should throw error if manifest is missing in production', () => {
      expect(() => service.getClientScriptTag(false)).toThrow(
        'Manifest missing entry for src/view/entry-client.tsx',
      );
    });

    it('should throw error if manifest entry is missing in production', () => {
      const manifest = {
        'other-file.tsx': { file: 'assets/other-abc123.js' },
      };

      expect(() => service.getClientScriptTag(false, manifest)).toThrow(
        'Manifest missing entry for src/view/entry-client.tsx',
      );
    });
  });

  describe('getStylesheetTags', () => {
    it('should return development stylesheet tag in development mode', () => {
      const result = service.getStylesheetTags(true);

      expect(result).toBe(
        '<link rel="stylesheet" href="/src/view/styles/globals.css" />',
      );
    });

    it('should return empty string if no CSS in manifest', () => {
      const manifest = {
        'src/view/entry-client.tsx': {
          file: 'assets/entry-client-abc123.js',
        },
      };

      const result = service.getStylesheetTags(false, manifest);

      expect(result).toBe('');
    });

    it('should return stylesheet tags from manifest CSS files', () => {
      const manifest = {
        'src/view/entry-client.tsx': {
          file: 'assets/entry-client-abc123.js',
          css: ['assets/style1-abc.css', 'assets/style2-def.css'],
        },
      };

      const result = service.getStylesheetTags(false, manifest);

      expect(result).toContain('<link rel="stylesheet" href="/assets/style1-abc.css" />');
      expect(result).toContain('<link rel="stylesheet" href="/assets/style2-def.css" />');
    });

    it('should return empty string if manifest is missing', () => {
      const result = service.getStylesheetTags(false);

      expect(result).toBe('');
    });
  });

  describe('buildHeadTags', () => {
    it('should return empty string if no head data', () => {
      const result = service.buildHeadTags();

      expect(result).toBe('');
    });

    it('should build title tag', () => {
      const head: HeadData = {
        title: 'Test Page',
      };

      const result = service.buildHeadTags(head);

      expect(result).toContain('<title>Test Page</title>');
    });

    it('should build description meta tag', () => {
      const head: HeadData = {
        description: 'This is a test page',
      };

      const result = service.buildHeadTags(head);

      expect(result).toContain('<meta name="description" content="This is a test page" />');
    });

    it('should build keywords meta tag', () => {
      const head: HeadData = {
        keywords: 'test, page, example',
      };

      const result = service.buildHeadTags(head);

      expect(result).toContain('<meta name="keywords" content="test, page, example" />');
    });

    it('should build canonical link tag', () => {
      const head: HeadData = {
        canonical: 'https://example.com/test',
      };

      const result = service.buildHeadTags(head);

      expect(result).toContain('<link rel="canonical" href="https://example.com/test" />');
    });

    it('should build Open Graph tags', () => {
      const head: HeadData = {
        ogTitle: 'OG Title',
        ogDescription: 'OG Description',
        ogImage: 'https://example.com/image.png',
      };

      const result = service.buildHeadTags(head);

      expect(result).toContain('<meta property="og:title" content="OG Title" />');
      expect(result).toContain('<meta property="og:description" content="OG Description" />');
      expect(result).toContain('<meta property="og:image" content="https://example.com/image.png" />');
    });

    it('should escape HTML in head tags', () => {
      const head: HeadData = {
        title: 'Test <script>alert("xss")</script>',
        description: '"><script>alert("xss")</script>',
      };

      const result = service.buildHeadTags(head);

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&quot;&gt;');
    });

    it('should build custom link tags', () => {
      const head: HeadData = {
        links: [
          { rel: 'icon', href: '/favicon.ico' },
          { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        ],
      };

      const result = service.buildHeadTags(head);

      expect(result).toContain('<link rel="icon" href="/favicon.ico" />');
      expect(result).toContain('<link rel="preconnect" href="https://fonts.googleapis.com" />');
    });

    it('should build custom meta tags', () => {
      const head: HeadData = {
        meta: [
          { name: 'viewport', content: 'width=device-width, initial-scale=1' },
          { name: 'author', content: 'John Doe' },
        ],
      };

      const result = service.buildHeadTags(head);

      expect(result).toContain('<meta name="viewport" content="width=device-width, initial-scale=1" />');
      expect(result).toContain('<meta name="author" content="John Doe" />');
    });

    it('should escape HTML in custom tags', () => {
      const head: HeadData = {
        links: [{ rel: 'icon', href: '"><script>alert("xss")</script>' }],
        meta: [{ name: 'test', content: '<script>alert("xss")</script>' }],
      };

      const result = service.buildHeadTags(head);

      expect(result).not.toContain('<script>alert');
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&quot;&gt;');
    });

    it('should build complete head with all tags', () => {
      const head: HeadData = {
        title: 'Complete Test',
        description: 'A complete test page',
        keywords: 'test, complete',
        canonical: 'https://example.com/complete',
        ogTitle: 'OG Complete Test',
        ogDescription: 'OG complete description',
        ogImage: 'https://example.com/og-image.png',
        links: [{ rel: 'icon', href: '/favicon.ico' }],
        meta: [{ name: 'viewport', content: 'width=device-width' }],
      };

      const result = service.buildHeadTags(head);

      expect(result).toContain('<title>Complete Test</title>');
      expect(result).toContain('<meta name="description" content="A complete test page" />');
      expect(result).toContain('<meta name="keywords" content="test, complete" />');
      expect(result).toContain('<link rel="canonical" href="https://example.com/complete" />');
      expect(result).toContain('<meta property="og:title" content="OG Complete Test" />');
      expect(result).toContain('<link rel="icon" href="/favicon.ico" />');
      expect(result).toContain('<meta name="viewport" content="width=device-width" />');
    });
  });
});
