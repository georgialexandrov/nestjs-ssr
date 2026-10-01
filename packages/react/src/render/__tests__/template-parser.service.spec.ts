import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateParserService } from '../template-parser.service';
import type { HeadData } from '../../interfaces';
import { createDefaultTestProjectPaths } from './test-project-paths';

const defaultProjectPaths = createDefaultTestProjectPaths('/project');

describe('TemplateParserService', () => {
  let service: TemplateParserService;

  beforeEach(() => {
    service = new TemplateParserService(defaultProjectPaths);
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
      const componentName = 'Home';

      const result = service.buildInlineScripts(data, context, componentName);

      expect(result).toContain('window.__INITIAL_STATE__');
      expect(result).toContain('window.__CONTEXT__');
      expect(result).toContain('window.__COMPONENT_NAME__');
      // devalue uses JavaScript object literal format (no quotes around keys)
      expect(result).toContain('message:"Hello World"');
      expect(result).toContain('count:42');
      // devalue safely serializes paths (no escaping needed)
      expect(result).toContain('path:"/test"');
      expect(result).toContain('"Home"');
    });

    it('should safely serialize special characters', () => {
      const data = { script: '<script>alert("xss")</script>' };
      const context = {};
      const componentPath = 'views/test';

      const result = service.buildInlineScripts(data, context, componentPath);

      // devalue safely serializes as a JavaScript string literal
      // The dangerous string is properly quoted and escaped
      expect(result).toContain('window.__INITIAL_STATE__');
      expect(result).toContain('script:');
      // devalue escapes the string content safely for JavaScript using \u codes
      expect(result).toMatch(/\\u003C.*script.*\\u003C\/script/i);
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

      // devalue uses JavaScript object literal format
      expect(result).toContain('name:"John"');
      expect(result).toContain('age:30');
      expect(result).toContain('theme:"dark"');
    });

    it('omits window.__HEAD__ entirely when the page has no head data', () => {
      const result = service.buildInlineScripts({}, {}, 'Home');

      expect(result).not.toContain('__HEAD__');
    });

    it('writes window.__HEAD__ when the page has head data', () => {
      const result = service.buildInlineScripts(
        {},
        {},
        'Home',
        [],
        undefined,
        { title: 'Home' },
      );

      expect(result).toContain('window.__HEAD__');
      expect(result).toContain('title:"Home"');
    });
  });

  describe('getClientScriptTag', () => {
    it('should return development script tag in development mode', () => {
      const result = service.getClientScriptTag(true);

      expect(result).toBe(
        '<script type="module" src="/src/views/entry-client.tsx"></script>',
      );
    });

    it('should return production script tag with manifest', () => {
      const manifest = {
        'src/views/entry-client.tsx': {
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
        'Manifest missing entry for src/views/entry-client.tsx',
      );
    });

    it('should throw error if manifest entry is missing in production', () => {
      const manifest = {
        'other-file.tsx': { file: 'assets/other-abc123.js' },
      };

      expect(() => service.getClientScriptTag(false, manifest)).toThrow(
        'Manifest missing entry for src/views/entry-client.tsx',
      );
    });
  });

  describe('getStylesheetTags', () => {
    it('should return empty string in development mode (no global CSS)', () => {
      const result = service.getStylesheetTags(true);

      expect(result).toBe('');
    });

    it('should return empty string if no CSS in manifest', () => {
      const manifest = {
        'src/views/entry-client.tsx': {
          file: 'assets/entry-client-abc123.js',
        },
      };

      const result = service.getStylesheetTags(false, manifest);

      expect(result).toBe('');
    });

    it('should return stylesheet tags from manifest CSS files', () => {
      const manifest = {
        'src/views/entry-client.tsx': {
          file: 'assets/entry-client-abc123.js',
          css: ['assets/style1-abc.css', 'assets/style2-def.css'],
        },
      };

      const result = service.getStylesheetTags(false, manifest);

      expect(result).toContain(
        '<link rel="stylesheet" href="/assets/style1-abc.css" />',
      );
      expect(result).toContain(
        '<link rel="stylesheet" href="/assets/style2-def.css" />',
      );
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

      expect(result).toContain(
        '<meta name="description" content="This is a test page" />',
      );
    });

    it('should build keywords meta tag', () => {
      const head: HeadData = {
        keywords: 'test, page, example',
      };

      const result = service.buildHeadTags(head);

      expect(result).toContain(
        '<meta name="keywords" content="test, page, example" />',
      );
    });

    it('should build canonical link tag', () => {
      const head: HeadData = {
        canonical: 'https://example.com/test',
      };

      const result = service.buildHeadTags(head);

      expect(result).toContain(
        '<link rel="canonical" href="https://example.com/test" />',
      );
    });

    it('should build Open Graph tags', () => {
      const head: HeadData = {
        ogTitle: 'OG Title',
        ogDescription: 'OG Description',
        ogImage: 'https://example.com/image.png',
      };

      const result = service.buildHeadTags(head);

      expect(result).toContain(
        '<meta property="og:title" content="OG Title" />',
      );
      expect(result).toContain(
        '<meta property="og:description" content="OG Description" />',
      );
      expect(result).toContain(
        '<meta property="og:image" content="https://example.com/image.png" />',
      );
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
      expect(result).toContain(
        '<link rel="preconnect" href="https://fonts.googleapis.com" />',
      );
    });

    it('should build custom meta tags', () => {
      const head: HeadData = {
        meta: [
          { name: 'viewport', content: 'width=device-width, initial-scale=1' },
          { name: 'author', content: 'John Doe' },
        ],
      };

      const result = service.buildHeadTags(head);

      expect(result).toContain(
        '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      );
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
      expect(result).toContain(
        '<meta name="description" content="A complete test page" />',
      );
      expect(result).toContain(
        '<meta name="keywords" content="test, complete" />',
      );
      expect(result).toContain(
        '<link rel="canonical" href="https://example.com/complete" />',
      );
      expect(result).toContain(
        '<meta property="og:title" content="OG Complete Test" />',
      );
      expect(result).toContain('<link rel="icon" href="/favicon.ico" />');
      expect(result).toContain(
        '<meta name="viewport" content="width=device-width" />',
      );
    });

    it('should skip attribute names that are not valid HTML identifiers', () => {
      const head: HeadData = {
        meta: [
          {
            'autofocus onfocus=alert(1)': 'x',
            name: 'safe',
            content: 'value',
          } as any,
        ],
      };

      const result = service.buildHeadTags(head);

      expect(result).not.toContain('onfocus');
      expect(result).toContain('name="safe"');
      expect(result).toContain('content="value"');
    });

    it('should reject executable event-handler attributes', () => {
      const head: HeadData = {
        links: [
          {
            rel: 'stylesheet',
            href: '/missing.css',
            onerror: 'alert(document.domain)',
            onload: 'alert(1)',
          } as any,
        ],
      };

      const result = service.buildHeadTags(head);

      expect(result).toBe('<link rel="stylesheet" href="/missing.css" />');
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('onload');
    });

    it('should retain explicitly supported security attributes', () => {
      const result = service.buildHeadTags({
        links: [
          {
            rel: 'stylesheet',
            href: 'https://cdn.example/app.css',
            integrity: 'sha384-test',
            crossorigin: 'anonymous',
            referrerpolicy: 'no-referrer',
          },
        ],
      });

      expect(result).toContain('integrity="sha384-test"');
      expect(result).toContain('crossorigin="anonymous"');
      expect(result).toContain('referrerpolicy="no-referrer"');
    });
  });

  describe('CSP nonce support', () => {
    it('should add nonce to inline state script when provided', () => {
      const result = service.buildInlineScripts(
        { a: 1 },
        {},
        'Page',
        [],
        'abc123',
      );

      expect(result).toContain('<script nonce="abc123">');
    });

    it('should not add a nonce attribute when none is provided', () => {
      const result = service.buildInlineScripts({ a: 1 }, {}, 'Page', []);

      expect(result).toContain('<script>');
      expect(result).not.toContain('nonce');
    });

    it('should escape the nonce value', () => {
      const result = service.buildInlineScripts(
        {},
        {},
        'Page',
        [],
        '"><script>alert(1)</script>',
      );

      expect(result).not.toContain('"><script>alert(1)</script>>');
      expect(result).toContain('&quot;&gt;');
    });

    it('should add nonce to client script tags', () => {
      const dev = service.getClientScriptTag(true, undefined, 'abc123');
      expect(dev).toContain('nonce="abc123"');

      const prod = service.getClientScriptTag(
        false,
        {
          'src/views/entry-client.tsx': { file: 'assets/entry-abc.js' },
        },
        'abc123',
      );
      expect(prod).toContain('nonce="abc123"');
      expect(prod).toContain('src="/assets/entry-abc.js"');
    });
  });

  describe('manifest entry resolution', () => {
    it('should find client entry by lenient lookup when key differs', () => {
      const manifest = {
        'app/frontend/entry-client.tsx': {
          file: 'assets/entry-client-xyz.js',
          isEntry: true,
        },
      };

      const result = service.getClientScriptTag(false, manifest);

      expect(result).toContain('src="/assets/entry-client-xyz.js"');
    });

    it('memoizes the resolved entry per manifest reference across the three call sites that use it', () => {
      const manifest: Record<
        string,
        { file: string; css?: string[]; isEntry?: boolean }
      > = {
        'src/views/entry-client.tsx': {
          file: 'assets/entry-client-abc.js',
          css: ['assets/entry-client-abc.css'],
        },
      };

      // findClientEntry is private; exercise it through the three public
      // methods that share it (getClientScriptTag, getStylesheetTags,
      // getRouteAssetTags), all against the same manifest object.
      const script = service.getClientScriptTag(false, manifest);
      const styles = service.getStylesheetTags(false, manifest);
      expect(script).toContain('src="/assets/entry-client-abc.js"');
      expect(styles).toContain('href="/assets/entry-client-abc.css"');

      // Removing the entry from the manifest after the first resolution
      // must not affect a later read against the same reference: the
      // lookup is memoized by reference, matching the serverModuleCache
      // pattern in server-module-loader.ts. Without memoization this
      // second call would recompute, find nothing, and throw.
      delete manifest['src/views/entry-client.tsx'];
      const scriptAgain = service.getClientScriptTag(false, manifest);
      expect(scriptAgain).toBe(script);
    });
  });

  describe('getRouteAssetTags', () => {
    const eagerManifest = {
      'src/views/entry-client.tsx': {
        file: 'assets/client-abc.js',
        isEntry: true,
        css: ['assets/client-abc.css'],
        imports: ['_vendor.js'],
      },
      '_vendor.js': { file: 'assets/vendor-xyz.js' },
    };
    const lazyManifest = {
      'src/views/entry-client.tsx': {
        file: 'assets/client-abc.js',
        isEntry: true,
        css: ['assets/client-abc.css'],
        imports: ['_vendor.js'],
        dynamicImports: [
          'src/views/recipe-list.tsx',
          'src/views/recipes-layout.tsx',
          'src/views/home.tsx',
        ],
      },
      '_vendor.js': { file: 'assets/vendor-xyz.js' },
      '_shared.js': { file: 'assets/shared-1.js', imports: ['_vendor.js'] },
      'src/views/recipe-list.tsx': {
        file: 'assets/recipe-list-1.js',
        imports: ['_shared.js', '_vendor.js'],
        css: ['assets/recipe-list-1.css'],
      },
      'src/views/recipes-layout.tsx': { file: 'assets/recipes-layout-1.js' },
      'src/views/home.tsx': { file: 'assets/home-1.js' },
    };
    const layouts = [
      { layout: Object.assign(() => null, { displayName: 'RecipesLayout' }) },
    ];

    it('adds nothing for an eager view registry, keeping pages byte-identical', () => {
      expect(
        service.getRouteAssetTags(false, eagerManifest, 'RecipeList', layouts),
      ).toBe('');
    });

    it('adds nothing in development or without a manifest', () => {
      expect(service.getRouteAssetTags(true, lazyManifest, 'RecipeList')).toBe(
        '',
      );
      expect(service.getRouteAssetTags(false, null, 'RecipeList')).toBe('');
    });

    it("preloads the route's view, layout and their imports, not other views", () => {
      const tags = service.getRouteAssetTags(
        false,
        lazyManifest,
        'RecipeList',
        layouts,
        'n0nce',
      );
      expect(tags).toContain('href="/assets/recipe-list-1.js"');
      expect(tags).toContain('href="/assets/recipes-layout-1.js"');
      expect(tags).toContain('href="/assets/shared-1.js"');
      expect(tags).toContain(
        '<link rel="stylesheet" href="/assets/recipe-list-1.css" />',
      );
      expect(tags).toContain('nonce="n0nce"');
      expect(tags).not.toContain('home-1.js');
      // Already requested by the entry script itself.
      expect(tags).not.toContain('vendor-xyz.js');
      expect(tags).not.toContain('client-abc');
    });

    it('adds nothing for a name no view file follows the convention for', () => {
      expect(
        service.getRouteAssetTags(false, lazyManifest, 'SpecialsList'),
      ).toBe('');
    });

    it('preloads a view the Vite plugin index names, whatever its file is called', () => {
      const manifest = {
        ...lazyManifest,
        'src/views/entry-client.tsx': {
          ...lazyManifest['src/views/entry-client.tsx'],
          dynamicImports: [
            ...lazyManifest['src/views/entry-client.tsx'].dynamicImports,
            'src/specials/views/weekly.tsx',
          ],
        },
        'src/specials/views/weekly.tsx': { file: 'assets/weekly-1.js' },
      };
      const tags = service.getRouteAssetTags(
        false,
        manifest,
        'SpecialsList',
        undefined,
        undefined,
        { SpecialsList: ['src/specials/views/weekly.tsx'] },
      );
      expect(tags).toBe(
        '<link rel="modulepreload" crossorigin href="/assets/weekly-1.js" />',
      );
    });

    it('produces byte-identical output across repeated renders of the same route (cached vs. uncached)', () => {
      const first = service.getRouteAssetTags(
        false,
        lazyManifest,
        'RecipeList',
        layouts,
        'n0nce',
      );
      // Second call hits the per-manifest route-asset cache added for 2.3b.
      const second = service.getRouteAssetTags(
        false,
        lazyManifest,
        'RecipeList',
        layouts,
        'n0nce',
      );
      expect(second).toBe(first);

      // Proves the second call actually served the cache rather than
      // recomputing from the manifest: a mutation to the manifest object
      // made between calls (which would change the freshly-computed
      // module/style list) is not reflected in a same-reference read.
      const mutable = structuredClone(lazyManifest) as typeof lazyManifest;
      const before = service.getRouteAssetTags(
        false,
        mutable,
        'RecipeList',
        layouts,
        'n0nce',
      );
      (
        mutable['src/views/recipe-list.tsx'] as { css?: string[] }
      ).css?.push('assets/recipe-list-2.css');
      const after = service.getRouteAssetTags(
        false,
        mutable,
        'RecipeList',
        layouts,
        'n0nce',
      );
      expect(after).toBe(before);
      expect(after).not.toContain('recipe-list-2.css');
    });

    it('reuses the cached module/style list across requests with different nonces', () => {
      const withNonceA = service.getRouteAssetTags(
        false,
        lazyManifest,
        'RecipeList',
        layouts,
        'nonce-a',
      );
      const withNonceB = service.getRouteAssetTags(
        false,
        lazyManifest,
        'RecipeList',
        layouts,
        'nonce-b',
      );

      expect(withNonceA).toContain('nonce="nonce-a"');
      expect(withNonceB).toContain('nonce="nonce-b"');
      // Everything but the nonce attribute is identical: the cache serves
      // the shared module/style list and only the nonce is spliced in.
      expect(withNonceA.replace(/nonce-a/g, 'X')).toBe(
        withNonceB.replace(/nonce-b/g, 'X'),
      );
    });
  });
});
