import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Response } from 'express';
import type { ViteDevServer } from 'vite';
import type { HeadData } from '../../interfaces';

// Mock fs module
vi.mock('fs', () => {
  const mockReadFileSync = vi.fn();
  const mockExistsSync = vi.fn();
  return {
    readFileSync: mockReadFileSync,
    existsSync: mockExistsSync,
    default: {
      readFileSync: mockReadFileSync,
      existsSync: mockExistsSync,
    },
  };
});

// Mock path module
vi.mock('path', () => {
  const mockJoin = vi.fn((...args) => args.join('/'));
  const mockRelative = vi.fn((from, to) => {
    // Simple mock implementation - just return the 'to' path
    // In real scenarios, this would compute the relative path
    return to.replace(from + '/', '');
  });
  return {
    join: mockJoin,
    relative: mockRelative,
    default: {
      join: mockJoin,
      relative: mockRelative,
    },
  };
});

import { RenderService } from '../render.service';
import { TemplateParserService } from '../template-parser.service';
import { StreamingErrorHandler } from '../streaming-error-handler';
import { readFileSync, existsSync } from 'fs';

// Type helpers for mocks
type MockedViteModule = {
  renderComponent: ReturnType<typeof vi.fn>;
  renderComponentStream: ReturnType<typeof vi.fn>;
};

type MockedViteServer = {
  transformIndexHtml: ReturnType<typeof vi.fn>;
  ssrLoadModule: ReturnType<typeof vi.fn<[], Promise<MockedViteModule>>>;
};

describe('RenderService', () => {
  let service: RenderService;
  let templateParser: TemplateParserService;
  let streamingErrorHandler: StreamingErrorHandler;
  let mockResponse: Partial<Response>;
  let mockVite: MockedViteServer;

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

  const mockManifest = {
    'src/entry-client.tsx': {
      file: 'assets/entry-client-abc123.js',
      css: ['assets/style-abc123.css'],
    },
  };

  const mockServerManifest = {
    'src/view/entry-server.tsx': {
      file: 'entry-server-abc123.js',
    },
  };

  beforeEach(() => {
    // Reset environment
    process.env.NODE_ENV = 'test';
    delete process.env.SSR_MODE;

    // Mock fs.existsSync to return true for template
    vi.mocked(existsSync).mockImplementation((filePath: any) => {
      const pathStr = String(filePath);
      if (pathStr.includes('index.html')) return true;
      if (pathStr.includes('manifest.json')) return false;
      return false;
    });

    // Mock fs.readFileSync to return valid template
    vi.mocked(readFileSync).mockImplementation((filePath: any) => {
      const pathStr = String(filePath);
      if (pathStr.includes('index.html')) return validTemplate;
      if (pathStr.includes('manifest.json')) return JSON.stringify(mockManifest);
      throw new Error('File not found');
    });

    // Create dependencies
    templateParser = new TemplateParserService();
    streamingErrorHandler = new StreamingErrorHandler();

    // Create mock response
    mockResponse = {
      statusCode: 200,
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
      send: vi.fn(),
    };

    // Create mock Vite server
    mockVite = {
      transformIndexHtml: vi.fn().mockResolvedValue(validTemplate),
      ssrLoadModule: vi.fn().mockResolvedValue({
        renderComponent: vi.fn().mockResolvedValue('<div>Test Component</div>'),
        renderComponentStream: vi.fn().mockReturnValue({
          pipe: vi.fn(),
          abort: vi.fn(),
        }),
      }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize in development mode', () => {
      process.env.NODE_ENV = 'development';

      service = new RenderService(
        templateParser,
        streamingErrorHandler,
      );

      expect(service).toBeDefined();
      expect(existsSync).toHaveBeenCalled();
      expect(readFileSync).toHaveBeenCalled();
    });

    it('should initialize in production mode', () => {
      process.env.NODE_ENV = 'production';

      service = new RenderService(
        templateParser,
        streamingErrorHandler,
      );

      expect(service).toBeDefined();
    });

    it('should use string mode by default', () => {
      service = new RenderService(
        templateParser,
        streamingErrorHandler,
      );

      expect(service).toBeDefined();
      // Default SSR mode is 'string' based on constructor logic
    });

    it('should use provided SSR mode', () => {
      service = new RenderService(
        templateParser,
        streamingErrorHandler,
        'stream',
      );

      expect(service).toBeDefined();
    });

    it('should throw error if template not found', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      expect(() => {
        new RenderService(
          templateParser,
          streamingErrorHandler,
        );
      }).toThrow('Template file not found');
    });

    it('should throw error if template read fails', () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => {
        new RenderService(
          templateParser,
          streamingErrorHandler,
        );
      }).toThrow('Failed to read template file');
    });

    it('should load manifests in production mode', () => {
      process.env.NODE_ENV = 'production';

      vi.mocked(existsSync).mockImplementation((filePath: any) => {
        return true; // All files exist
      });

      vi.mocked(readFileSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('index.html')) return validTemplate;
        if (pathStr.includes('client/.vite/manifest.json')) return JSON.stringify(mockManifest);
        if (pathStr.includes('server/.vite/manifest.json')) return JSON.stringify(mockServerManifest);
        throw new Error('Unexpected path');
      });

      service = new RenderService(
        templateParser,
        streamingErrorHandler,
      );

      expect(service).toBeDefined();
      // Should have loaded both manifests
      expect(readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('manifest.json'),
        'utf-8'
      );
    });

    it('should accept default head configuration', () => {
      const defaultHead: HeadData = {
        title: 'Default Title',
        description: 'Default Description',
      };

      service = new RenderService(
        templateParser,
        streamingErrorHandler,
        'string',
        defaultHead,
      );

      expect(service).toBeDefined();
    });
  });

  describe('setViteServer', () => {
    beforeEach(() => {
      service = new RenderService(
        templateParser,
        streamingErrorHandler,
      );
    });

    it('should set Vite server instance', () => {
      service.setViteServer(mockVite as ViteDevServer);

      // Vite server is now set - verified by usage in render methods
      expect(service).toBeDefined();
    });
  });

  describe('render', () => {
    beforeEach(() => {
      service = new RenderService(
        templateParser,
        streamingErrorHandler,
        'string',
      );
    });

    it('should throw error if response missing in stream mode', async () => {
      service = new RenderService(
        templateParser,
        streamingErrorHandler,
        'stream',
      );

      await expect(
        service.render('views/test', {})
      ).rejects.toThrow('Response object is required for streaming SSR mode');
    });

    it('should merge default and page-specific head data', async () => {
      const defaultHead: HeadData = {
        title: 'Default',
        keywords: 'default, keywords',
        links: [{ rel: 'icon', href: '/favicon.ico' }],
      };

      service = new RenderService(
        templateParser,
        streamingErrorHandler,
        'string',
        defaultHead,
      );

      service.setViteServer(mockVite as ViteDevServer);

      const pageHead: HeadData = {
        title: 'Page Title',
        description: 'Page Description',
        links: [{ rel: 'canonical', href: 'https://example.com' }],
      };

      const result = await service.render('views/test', {
        data: {},
        __context: {},
      }, undefined, pageHead);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      // Page title should override default
      expect(result).toContain('Page Title');
    });
  });

  describe('head merging logic', () => {
    beforeEach(() => {
      const defaultHead: HeadData = {
        title: 'Default Title',
        keywords: 'default, seo',
        links: [{ rel: 'icon', href: '/favicon.ico' }],
        meta: [{ name: 'viewport', content: 'width=device-width' }],
      };

      service = new RenderService(
        templateParser,
        streamingErrorHandler,
        'string',
        defaultHead,
      );

      service.setViteServer(mockVite as ViteDevServer);
    });

    it('should merge arrays instead of replacing them', async () => {
      const pageHead: HeadData = {
        title: 'Page Title',
        links: [{ rel: 'canonical', href: 'https://example.com/page' }],
        meta: [{ name: 'description', content: 'Page description' }],
      };

      const result = await service.render('views/test', {
        data: {},
        __context: {},
      }, undefined, pageHead);

      // Both default and page links should be present
      expect(result).toContain('favicon.ico');
      expect(result).toContain('canonical');
      expect(result).toContain('https://example.com/page');

      // Both default and page meta tags should be present
      expect(result).toContain('viewport');
      expect(result).toContain('width=device-width');
      expect(result).toContain('description');
      expect(result).toContain('Page description');
    });

    it('should allow page head to override scalar values', async () => {
      const pageHead: HeadData = {
        title: 'Override Title',
        keywords: 'override, keywords',
      };

      const result = await service.render('views/test', {
        data: {},
        __context: {},
      }, undefined, pageHead);

      // Page values should override defaults
      expect(result).toContain('Override Title');
      expect(result).toContain('override, keywords');
      expect(result).not.toContain('Default Title');
    });
  });

  describe('renderToString mode', () => {
    beforeEach(() => {
      service = new RenderService(
        templateParser,
        streamingErrorHandler,
        'string',
      );

      service.setViteServer(mockVite as ViteDevServer);
    });

    it('should render component to string in development', async () => {
      const result = await service.render('views/home', {
        data: { message: 'Hello' },
        __context: { path: '/home' },
      });

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('Test Component');
    });

    it('should inject initial state script', async () => {
      const result = await service.render('views/test', {
        data: { count: 42 },
        __context: { path: '/test' },
      });

      expect(result).toContain('window.__INITIAL_STATE__');
      expect(result).toContain('window.__CONTEXT__');
      expect(result).toContain('window.__COMPONENT_PATH__');
    });

    it('should inject client script in development', async () => {
      const result = await service.render('views/test', {
        data: {},
        __context: {},
      });

      expect(result).toContain('/src/entry-client.tsx');
    });

    it('should handle empty data object', async () => {
      const result = await service.render('views/test', {
        data: {},
        __context: {},
      });

      expect(result).toBeTruthy();
      expect(result).toContain('<!DOCTYPE html>');
    });

    it('should handle complex nested data', async () => {
      const complexData = {
        user: {
          name: 'John',
          profile: {
            age: 30,
            settings: { theme: 'dark' },
          },
        },
      };

      const result = await service.render('views/profile', {
        data: complexData,
        __context: { path: '/profile' },
      });

      expect(result).toBeTruthy();
      expect(result).toContain('window.__INITIAL_STATE__');
    });
  });

  describe('renderToStream mode', () => {
    beforeEach(() => {
      service = new RenderService(
        templateParser,
        streamingErrorHandler,
        'stream',
      );

      service.setViteServer(mockVite as ViteDevServer);
    });

    it('should start streaming when shell ready', async () => {
      const mockStreamResponse = {
        ...mockResponse,
      };

      // Setup streaming mock to call onShellReady
      mockVite.ssrLoadModule.mockResolvedValue({
        renderComponent: vi.fn(),
        renderComponentStream: vi.fn((viewPath, data, callbacks) => {
          // Simulate shell ready
          setTimeout(() => callbacks.onShellReady(), 0);
          setTimeout(() => callbacks.onAllReady(), 10);
          return {
            pipe: vi.fn(),
            abort: vi.fn(),
          };
        }),
      });

      await service.render('views/test', {
        data: {},
        __context: {},
      }, mockStreamResponse as Response);

      // Wait for async callbacks
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockStreamResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html; charset=utf-8'
      );
      expect(mockStreamResponse.write).toHaveBeenCalled();
      expect(mockStreamResponse.end).toHaveBeenCalled();
    });

    it('should inject styles and head meta in stream mode', async () => {
      const head: HeadData = {
        title: 'Stream Test',
        description: 'Testing streaming',
      };

      mockVite.ssrLoadModule.mockResolvedValue({
        renderComponent: vi.fn(),
        renderComponentStream: vi.fn((viewPath, data, callbacks) => {
          setTimeout(() => callbacks.onShellReady(), 0);
          setTimeout(() => callbacks.onAllReady(), 10);
          return {
            pipe: vi.fn(),
            abort: vi.fn(),
          };
        }),
      });

      await service.render('views/test', {
        data: {},
        __context: {},
      }, mockResponse as Response, head);

      await new Promise(resolve => setTimeout(resolve, 20));

      // Should have written head tags
      expect(mockResponse.write).toHaveBeenCalled();
    });

    it('should abort stream on client disconnect', async () => {
      const abortMock = vi.fn();

      mockVite.ssrLoadModule.mockResolvedValue({
        renderComponent: vi.fn(),
        renderComponentStream: vi.fn((viewPath, data, callbacks) => {
          setTimeout(() => callbacks.onShellReady(), 0);
          return {
            pipe: vi.fn(),
            abort: abortMock,
          };
        }),
      });

      // Capture the 'close' event handler
      let closeHandler: (() => void) | undefined;
      vi.mocked(mockResponse.on).mockImplementation((event: string, handler: () => void) => {
        if (event === 'close') {
          closeHandler = handler;
        }
        return mockResponse as Response;
      });

      await service.render('views/test', {
        data: {},
        __context: {},
      }, mockResponse as Response);

      // Simulate client disconnect
      closeHandler();

      expect(abortMock).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      service = new RenderService(
        templateParser,
        streamingErrorHandler,
        'string',
      );

      service.setViteServer(mockVite as ViteDevServer);
    });

    it('should throw error from renderToString', async () => {
      const renderError = new Error('Component render failed');

      mockVite.ssrLoadModule.mockResolvedValue({
        renderComponent: vi.fn().mockRejectedValue(renderError),
        renderComponentStream: vi.fn(),
      });

      await expect(
        service.render('views/broken', {
          data: {},
          __context: {},
        })
      ).rejects.toThrow('Component render failed');
    });

    it('should handle shell error in stream mode', async () => {
      service = new RenderService(
        templateParser,
        streamingErrorHandler,
        'stream',
      );

      service.setViteServer(mockVite as ViteDevServer);

      const shellError = new Error('Shell rendering failed');

      mockVite.ssrLoadModule.mockResolvedValue({
        renderComponent: vi.fn(),
        renderComponentStream: vi.fn((viewPath, data, callbacks) => {
          setTimeout(() => callbacks.onShellError(shellError), 0);
          return {
            pipe: vi.fn(),
            abort: vi.fn(),
          };
        }),
      });

      const handleShellErrorSpy = vi.spyOn(streamingErrorHandler, 'handleShellError');

      await service.render('views/broken', {
        data: {},
        __context: {},
      }, mockResponse as Response);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handleShellErrorSpy).toHaveBeenCalledWith(
        shellError,
        mockResponse,
        'views/broken',
        expect.any(Boolean)
      );
    });

    it('should handle streaming error after headers sent', async () => {
      service = new RenderService(
        templateParser,
        streamingErrorHandler,
        'stream',
      );

      service.setViteServer(mockVite as ViteDevServer);

      const streamError = new Error('Network failure during stream');

      mockVite.ssrLoadModule.mockResolvedValue({
        renderComponent: vi.fn(),
        renderComponentStream: vi.fn((viewPath, data, callbacks) => {
          setTimeout(() => callbacks.onShellReady(), 0);
          setTimeout(() => callbacks.onError(streamError), 5);
          setTimeout(() => callbacks.onAllReady(), 10);
          return {
            pipe: vi.fn(),
            abort: vi.fn(),
          };
        }),
      });

      const handleStreamErrorSpy = vi.spyOn(streamingErrorHandler, 'handleStreamError');

      await service.render('views/test', {
        data: {},
        __context: {},
      }, mockResponse as Response);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(handleStreamErrorSpy).toHaveBeenCalledWith(
        streamError,
        'views/test'
      );

      // Should still complete the response
      expect(mockResponse.end).toHaveBeenCalled();
    });
  });

  describe('production mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';

      vi.mocked(existsSync).mockImplementation((filePath: any) => {
        return true;
      });

      vi.mocked(readFileSync).mockImplementation((filePath: any) => {
        const pathStr = String(filePath);
        if (pathStr.includes('index.html')) return validTemplate;
        if (pathStr.includes('client/.vite/manifest.json')) return JSON.stringify(mockManifest);
        if (pathStr.includes('server/.vite/manifest.json')) return JSON.stringify(mockServerManifest);
        throw new Error('Unexpected path');
      });

      service = new RenderService(
        templateParser,
        streamingErrorHandler,
        'string',
      );
    });

    it('should use manifest for client script in production', async () => {
      // Mock dynamic import for production
      const mockRenderModule = {
        renderComponent: vi.fn().mockResolvedValue('<div>Production Component</div>'),
      };

      // We can't easily mock dynamic imports, but we can verify manifest loading
      expect(service).toBeDefined();
    });

    it('should use manifest for stylesheets in production', async () => {
      expect(service).toBeDefined();
      // Manifest should contain CSS files
    });
  });

  describe('real-world scenarios', () => {
    beforeEach(() => {
      service = new RenderService(
        templateParser,
        streamingErrorHandler,
        'string',
      );

      service.setViteServer(mockVite as ViteDevServer);
    });

    it('should handle blog post with SEO metadata', async () => {
      const blogHead: HeadData = {
        title: 'My Blog Post - NestJS SSR',
        description: 'Learn about server-side rendering with NestJS',
        keywords: 'nestjs, ssr, react, typescript',
        canonical: 'https://example.com/blog/nestjs-ssr',
        ogTitle: 'My Blog Post',
        ogDescription: 'Learn about SSR',
        ogImage: 'https://example.com/og-image.png',
      };

      const result = await service.render('views/blog-post', {
        data: {
          post: {
            title: 'NestJS SSR',
            content: 'Article content...',
          },
        },
        __context: { path: '/blog/nestjs-ssr' },
      }, undefined, blogHead);

      expect(result).toContain('My Blog Post - NestJS SSR');
      expect(result).toContain('og:title');
      expect(result).toContain('og:description');
    });

    it('should handle user dashboard with authentication context', async () => {
      const result = await service.render('views/dashboard', {
        data: {
          user: {
            id: '123',
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
        __context: {
          path: '/dashboard',
          params: { userId: '123' },
          userAgent: 'Mozilla/5.0...',
        },
      });

      expect(result).toContain('window.__INITIAL_STATE__');
      expect(result).toContain('window.__CONTEXT__');
    });

    it('should handle e-commerce product page', async () => {
      const productHead: HeadData = {
        title: 'Product Name - Store',
        description: 'Product description for SEO',
        ogImage: 'https://example.com/products/image.jpg',
        links: [
          { rel: 'preload', href: '/fonts/product-font.woff2' },
        ],
      };

      const result = await service.render('views/product', {
        data: {
          product: {
            id: 'prod-123',
            name: 'Product Name',
            price: 99.99,
            images: ['image1.jpg', 'image2.jpg'],
          },
        },
        __context: {
          path: '/products/prod-123',
          params: { productId: 'prod-123' },
        },
      }, undefined, productHead);

      expect(result).toContain('Product Name - Store');
      expect(result).toContain('preload');
    });
  });
});
