import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ViteDevServer } from 'vite';
import { StringRenderer } from '../renderers/string-renderer';
import type { StringRenderContext } from '../renderers/string-renderer';
import { TemplateParserService } from '../template-parser.service';

// Mock components
const MockPage = () => null;
MockPage.displayName = 'RecipesPage';

const MockLayout = () => null;
MockLayout.displayName = 'RecipesLayout';

const MockComponentNoName = () => null;

const validTemplate = `
<!DOCTYPE html>
<html>
<head>
  <!--head-meta-->
  <!--styles-->
</head>
<body>
  <div id="root"><!--app-html--></div>
  <!--initial-state-->
  <!--client-scripts-->
</body>
</html>
`.trim();

describe('StringRenderer', () => {
  let renderer: StringRenderer;
  let templateParser: TemplateParserService;

  beforeEach(() => {
    templateParser = new TemplateParserService();
    renderer = new StringRenderer(templateParser);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------
  // Production mode: manifest lookup for server entry (lines 66-87)
  // ---------------------------------------------------------------
  describe('render - production server manifest lookup', () => {
    const productionManifest = {
      'src/views/entry-server.tsx': {
        file: 'entry-server-abc123.js',
        isEntry: true,
        src: 'src/views/entry-server.tsx',
      },
    };

    const clientManifest = {
      'src/views/entry-client.tsx': {
        file: 'assets/entry-client-def456.js',
        isEntry: true,
        src: 'src/views/entry-client.tsx',
        css: ['assets/style-abc.css'],
      },
    };

    it('should throw when serverManifest has no entry-server entry', async () => {
      const manifestWithoutEntry = {
        'src/some-other-file.tsx': {
          file: 'other-abc123.js',
          isEntry: true,
          src: 'src/some-other-file.tsx',
        },
      };

      const context: StringRenderContext = {
        template: validTemplate,
        vite: null,
        manifest: clientManifest,
        serverManifest: manifestWithoutEntry,
        entryServerPath: 'src/views/entry-server.tsx',
        isDevelopment: false,
      };

      await expect(
        renderer.render(
          MockPage,
          { data: {}, __context: {}, __layouts: [] },
          context,
        ),
      ).rejects.toThrow(
        'Server bundle not found in manifest. Run `pnpm build:server` to generate the server bundle.',
      );
    });

    it('should throw when serverManifest is null (no manifest at all)', async () => {
      const context: StringRenderContext = {
        template: validTemplate,
        vite: null,
        manifest: clientManifest,
        serverManifest: null,
        entryServerPath: 'src/views/entry-server.tsx',
        isDevelopment: false,
      };

      await expect(
        renderer.render(
          MockPage,
          { data: {}, __context: {}, __layouts: [] },
          context,
        ),
      ).rejects.toThrow(
        'Server bundle not found in manifest. Run `pnpm build:server` to generate the server bundle.',
      );
    });

    it('should throw when manifest entry exists but isEntry is false', async () => {
      const manifestNotEntry = {
        'src/views/entry-server.tsx': {
          file: 'entry-server-abc123.js',
          isEntry: false,
          src: 'src/views/entry-server.tsx',
        },
      };

      const context: StringRenderContext = {
        template: validTemplate,
        vite: null,
        manifest: clientManifest,
        serverManifest: manifestNotEntry,
        entryServerPath: 'src/views/entry-server.tsx',
        isDevelopment: false,
      };

      await expect(
        renderer.render(
          MockPage,
          { data: {}, __context: {}, __layouts: [] },
          context,
        ),
      ).rejects.toThrow(
        'Server bundle not found in manifest. Run `pnpm build:server` to generate the server bundle.',
      );
    });
  });

  // ---------------------------------------------------------------
  // Production client script injection from manifest (lines 126-153)
  // ---------------------------------------------------------------
  describe('render - production client script injection', () => {
    const mockVite = {
      transformIndexHtml: vi.fn().mockResolvedValue(validTemplate),
      ssrLoadModule: vi.fn().mockResolvedValue({
        renderComponent: vi.fn().mockResolvedValue('<div>Test</div>'),
      }),
    } as unknown as ViteDevServer;

    function makeDevContext(
      overrides?: Partial<StringRenderContext>,
    ): StringRenderContext {
      return {
        template: validTemplate,
        vite: mockVite,
        manifest: null,
        serverManifest: null,
        entryServerPath: '/src/views/entry-server.tsx',
        isDevelopment: true,
        ...overrides,
      };
    }

    it('should inject dev client script in development mode', async () => {
      const context = makeDevContext();

      const result = await renderer.render(
        MockPage,
        { data: { title: 'Hello' }, __context: { path: '/' }, __layouts: [] },
        context,
      );

      // In dev mode, should use the dev client script
      expect(result).toContain('entry-client.tsx');
      expect(result).toContain(
        '<script type="module" src="/src/views/entry-client.tsx">',
      );
    });

    it('should inject initial state and component name', async () => {
      const context = makeDevContext();

      const result = await renderer.render(
        MockPage,
        {
          data: { items: [1, 2, 3] },
          __context: { path: '/recipes' },
          __layouts: [],
        },
        context,
      );

      expect(result).toContain('window.__INITIAL_STATE__');
      expect(result).toContain('window.__COMPONENT_NAME__');
      expect(result).toContain('RecipesPage');
    });

    it('should serialize layout metadata with names and props', async () => {
      const context = makeDevContext();

      const result = await renderer.render(
        MockPage,
        {
          data: { items: [] },
          __context: { path: '/recipes' },
          __layouts: [{ layout: MockLayout, props: { sidebar: true } }],
        },
        context,
      );

      expect(result).toContain('window.__LAYOUTS__');
      expect(result).toContain('RecipesLayout');
    });

    it('should handle layouts with no displayName, falling back to name', async () => {
      const NamedLayout = () => null;
      // No displayName set, will use .name

      const context = makeDevContext();

      const result = await renderer.render(
        MockPage,
        {
          data: {},
          __context: {},
          __layouts: [{ layout: NamedLayout, props: {} }],
        },
        context,
      );

      expect(result).toContain('window.__LAYOUTS__');
      expect(result).toContain('NamedLayout');
    });

    it('should use "default" for anonymous layout functions', async () => {
      const context = makeDevContext();

      const result = await renderer.render(
        MockPage,
        {
          data: {},
          __context: {},
          __layouts: [
            { layout: { displayName: undefined, name: '' }, props: {} },
          ],
        },
        context,
      );

      expect(result).toContain('window.__LAYOUTS__');
      expect(result).toContain('default');
    });

    it('should fallback to "Component" when viewComponent has no name', async () => {
      const context = makeDevContext();

      // Create a callable with no name/displayName
      const anonymous = { displayName: undefined, name: '' };

      const result = await renderer.render(
        anonymous,
        { data: {}, __context: {}, __layouts: [] },
        context,
      );

      expect(result).toContain('window.__COMPONENT_NAME__');
      expect(result).toContain('"Component"');
    });

    it('should handle empty layouts array', async () => {
      const context = makeDevContext();

      const result = await renderer.render(
        MockPage,
        { data: {}, __context: {}, __layouts: [] },
        context,
      );

      expect(result).toContain('window.__LAYOUTS__');
    });

    it('should handle undefined layouts', async () => {
      const context = makeDevContext();

      const result = await renderer.render(
        MockPage,
        { data: {}, __context: {} },
        context,
      );

      expect(result).toContain('window.__LAYOUTS__');
    });

    it('should inject head tags via TemplateParserService', async () => {
      const context = makeDevContext();

      const result = await renderer.render(
        MockPage,
        { data: {}, __context: {}, __layouts: [] },
        context,
        { title: 'Test Page', description: 'A test' },
      );

      expect(result).toContain('<title>Test Page</title>');
      expect(result).toContain('A test');
    });
  });

  // ---------------------------------------------------------------
  // Production client manifest edge cases (lines 126-153)
  // ---------------------------------------------------------------
  describe('production client manifest injection (isolated)', () => {
    it('should produce correct HTML structure with all placeholders replaced', async () => {
      const mockVite = {
        transformIndexHtml: vi.fn().mockResolvedValue(validTemplate),
        ssrLoadModule: vi.fn().mockResolvedValue({
          renderComponent: vi.fn().mockResolvedValue('<h1>Hello</h1>'),
        }),
      } as unknown as ViteDevServer;

      const context: StringRenderContext = {
        template: validTemplate,
        vite: mockVite,
        manifest: null,
        serverManifest: null,
        entryServerPath: '/src/views/entry-server.tsx',
        isDevelopment: true,
      };

      const result = await renderer.render(
        MockPage,
        { data: { msg: 'hi' }, __context: { path: '/' }, __layouts: [] },
        context,
        { title: 'Home' },
      );

      // All placeholders should be replaced
      expect(result).not.toContain('<!--app-html-->');
      expect(result).not.toContain('<!--initial-state-->');
      expect(result).not.toContain('<!--client-scripts-->');
      expect(result).not.toContain('<!--styles-->');
      expect(result).not.toContain('<!--head-meta-->');

      // Actual content should be present
      expect(result).toContain('<h1>Hello</h1>');
      expect(result).toContain('window.__INITIAL_STATE__');
      expect(result).toContain('<title>Home</title>');
    });
  });

  // ---------------------------------------------------------------
  // renderSegment() - lines 189-253
  // ---------------------------------------------------------------
  describe('renderSegment', () => {
    const mockRenderSegment = vi
      .fn()
      .mockResolvedValue('<div>Segment HTML</div>');

    const mockVite = {
      transformIndexHtml: vi.fn().mockResolvedValue(validTemplate),
      ssrLoadModule: vi.fn().mockResolvedValue({
        renderComponent: vi.fn(),
        renderSegment: mockRenderSegment,
      }),
    } as unknown as ViteDevServer;

    function makeContext(
      overrides?: Partial<StringRenderContext>,
    ): StringRenderContext {
      return {
        template: validTemplate,
        vite: mockVite,
        manifest: null,
        serverManifest: null,
        entryServerPath: '/src/views/entry-server.tsx',
        isDevelopment: false,
        ...overrides,
      };
    }

    it('should return SegmentResponse with html, componentName, layouts', async () => {
      const context = makeContext();

      const result = await renderer.renderSegment(
        MockPage,
        {
          data: { recipe: 'tarator' },
          __context: { path: '/recipes/tarator' },
          __layouts: [{ layout: MockLayout, props: { sidebar: false } }],
        },
        context,
        'RecipesLayout',
        { title: 'Tarator Recipe' },
      );

      expect(result).toEqual({
        html: '<div>Segment HTML</div>',
        head: { title: 'Tarator Recipe' },
        props: { recipe: 'tarator' },
        swapTarget: 'RecipesLayout',
        componentName: 'RecipesPage',
        context: { path: '/recipes/tarator' },
        layouts: [{ name: 'RecipesLayout', props: { sidebar: false } }],
      });
    });

    it('should call renderSegment on the loaded module with component and data', async () => {
      const context = makeContext();
      const data = {
        data: { id: 1 },
        __context: { path: '/test' },
        __layouts: [],
      };

      await renderer.renderSegment(MockPage, data, context, 'root');

      expect(mockRenderSegment).toHaveBeenCalledWith(MockPage, data);
    });

    it('should handle undefined head', async () => {
      const context = makeContext();

      const result = await renderer.renderSegment(
        MockPage,
        { data: {}, __context: {}, __layouts: [] },
        context,
        'root',
      );

      expect(result.head).toBeUndefined();
      expect(result.swapTarget).toBe('root');
    });

    it('should handle empty layouts', async () => {
      const context = makeContext();

      const result = await renderer.renderSegment(
        MockPage,
        { data: {}, __context: {}, __layouts: [] },
        context,
        'root',
      );

      expect(result.layouts).toEqual([]);
    });

    it('should handle undefined layouts (falsy)', async () => {
      const context = makeContext();

      const result = await renderer.renderSegment(
        MockPage,
        { data: {}, __context: {} },
        context,
        'root',
      );

      expect(result.layouts).toEqual([]);
    });

    it('should serialize multiple layouts with correct names', async () => {
      const RootLayout = () => null;
      RootLayout.displayName = 'RootLayout';

      const context = makeContext();

      const result = await renderer.renderSegment(
        MockPage,
        {
          data: {},
          __context: {},
          __layouts: [
            { layout: RootLayout, props: {} },
            { layout: MockLayout, props: { sidebar: true } },
          ],
        },
        context,
        'RootLayout',
      );

      expect(result.layouts).toEqual([
        { name: 'RootLayout', props: {} },
        { name: 'RecipesLayout', props: { sidebar: true } },
      ]);
    });

    it('should use "Component" fallback for unnamed viewComponent', async () => {
      const anonymous = { displayName: undefined, name: '' };
      const context = makeContext();

      const result = await renderer.renderSegment(
        anonymous,
        { data: {}, __context: {}, __layouts: [] },
        context,
        'root',
      );

      expect(result.componentName).toBe('Component');
    });

    it('should prefer displayName over name for componentName', async () => {
      const component = () => null;
      Object.defineProperty(component, 'name', { value: 'internalName' });
      component.displayName = 'PublicName';

      const context = makeContext();

      const result = await renderer.renderSegment(
        component,
        { data: {}, __context: {}, __layouts: [] },
        context,
        'root',
      );

      expect(result.componentName).toBe('PublicName');
    });

    it('should log performance in development mode', async () => {
      const logSpy = vi.spyOn((renderer as any).logger, 'log');
      const context = makeContext({ isDevelopment: true });

      await renderer.renderSegment(
        MockPage,
        { data: {}, __context: {}, __layouts: [] },
        context,
        'root',
      );

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('RecipesPage segment rendered in'),
      );
    });

    it('should NOT log performance in production mode', async () => {
      const logSpy = vi.spyOn((renderer as any).logger, 'log');
      const context = makeContext({ isDevelopment: false });

      await renderer.renderSegment(
        MockPage,
        { data: {}, __context: {}, __layouts: [] },
        context,
        'root',
      );

      expect(logSpy).not.toHaveBeenCalled();
    });

    // Production error paths for renderSegment
    it('should throw when serverManifest is null in production', async () => {
      const context = makeContext({ vite: null, serverManifest: null });

      await expect(
        renderer.renderSegment(
          MockPage,
          { data: {}, __context: {}, __layouts: [] },
          context,
          'root',
        ),
      ).rejects.toThrow('Server bundle not found in manifest');
    });

    it('should throw when serverManifest has no entry-server entry', async () => {
      const context = makeContext({
        vite: null,
        serverManifest: {
          'src/other.tsx': { file: 'other.js', isEntry: true },
        },
      });

      await expect(
        renderer.renderSegment(
          MockPage,
          { data: {}, __context: {}, __layouts: [] },
          context,
          'root',
        ),
      ).rejects.toThrow('Server bundle not found in manifest');
    });
  });

  // ---------------------------------------------------------------
  // Performance logging in render() (lines 166-173)
  // ---------------------------------------------------------------
  describe('render - development logging', () => {
    it('should log render time in development mode', async () => {
      const logSpy = vi.spyOn((renderer as any).logger, 'log');

      const mockVite = {
        transformIndexHtml: vi.fn().mockResolvedValue(validTemplate),
        ssrLoadModule: vi.fn().mockResolvedValue({
          renderComponent: vi.fn().mockResolvedValue('<div>Dev</div>'),
        }),
      } as unknown as ViteDevServer;

      const context: StringRenderContext = {
        template: validTemplate,
        vite: mockVite,
        manifest: null,
        serverManifest: null,
        entryServerPath: '/src/views/entry-server.tsx',
        isDevelopment: true,
      };

      await renderer.render(
        MockPage,
        { data: {}, __context: {}, __layouts: [] },
        context,
      );

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[SSR\] .+ rendered in \d+ms \(string mode\)/),
      );
    });

    it('should NOT log in production mode', async () => {
      const logSpy = vi.spyOn((renderer as any).logger, 'log');

      const mockVite = {
        transformIndexHtml: vi.fn().mockResolvedValue(validTemplate),
        ssrLoadModule: vi.fn().mockResolvedValue({
          renderComponent: vi.fn().mockResolvedValue('<div>Prod</div>'),
        }),
      } as unknown as ViteDevServer;

      const context: StringRenderContext = {
        template: validTemplate,
        vite: mockVite,
        manifest: null,
        serverManifest: null,
        entryServerPath: '/src/views/entry-server.tsx',
        isDevelopment: false,
      };

      await renderer.render(
        MockPage,
        { data: {}, __context: {}, __layouts: [] },
        context,
      );

      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
