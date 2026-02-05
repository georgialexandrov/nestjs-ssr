import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RenderInterceptor } from '../render.interceptor';
import { Reflector } from '@nestjs/core';
import { RenderService } from '../render.service';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import type { Request, Response } from 'express';
import { of, firstValueFrom, throwError } from 'rxjs';
import type { RenderResponse, HeadData } from '../../interfaces';

describe('RenderInterceptor', () => {
  let interceptor: RenderInterceptor;
  let mockReflector: Reflector;
  let mockRenderService: {
    render: ReturnType<typeof vi.fn>;
    getRootLayout: ReturnType<typeof vi.fn>;
  };
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Setup mock reflector
    mockReflector = {
      get: vi.fn(),
    } as unknown as Reflector;

    // Setup mock render service
    mockRenderService = {
      render: vi.fn(),
      getRootLayout: vi.fn().mockResolvedValue(null), // Default: no root layout
    };

    // Setup mock request
    mockRequest = {
      url: '/test?page=1',
      path: '/test',
      method: 'GET',
      query: { page: '1' },
      params: { id: '123' },
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'accept-language': 'en-US,en;q=0.9',
        referer: 'https://google.com',
        'x-tenant-id': 'tenant-123',
        'x-api-version': 'v2',
      },
      cookies: {
        theme: 'dark',
        locale: 'en-US',
      },
    } as unknown as Request;

    // Setup mock response
    mockResponse = {
      type: vi.fn(),
    } as Partial<Response>;

    // Setup mock execution context
    mockExecutionContext = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    // Setup mock call handler
    mockCallHandler = {
      handle: vi.fn(),
    } as unknown as CallHandler;

    interceptor = new RenderInterceptor(
      mockReflector,
      mockRenderService as unknown as RenderService,
    );
  });

  describe('intercept', () => {
    it('should proceed normally when no @Render decorator', async () => {
      const testData = { message: 'Hello' };

      // No render decorator
      vi.mocked(mockReflector.get).mockReturnValue(undefined);

      // Mock handler returning data
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      const data = await firstValueFrom(result$);
      expect(data).toEqual(testData);
      expect(mockRenderService.render).not.toHaveBeenCalled();
    });

    it('should render with flat object data', async () => {
      const testData = { message: 'Hello', count: 42 };
      const viewPath = 'views/test';

      // @Render decorator present
      vi.mocked(mockReflector.get).mockReturnValue(viewPath);

      // Mock handler returning flat object
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));

      // Mock render service returning HTML string
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      const html = await firstValueFrom(result$);
      expect(html).toBe('<html>Test</html>');
      expect(mockResponse.type).toHaveBeenCalledWith('text/html');
      expect(mockRenderService.render).toHaveBeenCalledWith(
        viewPath,
        expect.objectContaining({
          data: testData,
          __context: expect.objectContaining({
            url: '/test?page=1',
            path: '/test',
            query: { page: '1' },
            params: { id: '123' },
            method: 'GET',
            // Note: headers and cookies are only added when allowedHeaders/allowedCookies are configured
          }),
          __layouts: expect.any(Array),
        }),
        mockResponse,
        undefined,
      );
    });

    it('should render with RenderResponse structure', async () => {
      const renderResponse: RenderResponse = {
        props: { user: { name: 'John' } },
        head: {
          title: 'User Profile',
          description: 'User profile page',
        },
      };
      const viewPath = 'views/profile';

      // @Render decorator present
      vi.mocked(mockReflector.get).mockReturnValue(viewPath);

      // Mock handler returning RenderResponse
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(renderResponse));

      // Mock render service returning HTML string
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html><title>User Profile</title></html>',
      );

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      const html = await firstValueFrom(result$);
      expect(html).toBe('<html><title>User Profile</title></html>');
      expect(mockRenderService.render).toHaveBeenCalledWith(
        viewPath,
        expect.objectContaining({
          data: { user: { name: 'John' } },
          __context: expect.any(Object),
          __layouts: expect.any(Array),
        }),
        mockResponse,
        {
          title: 'User Profile',
          description: 'User profile page',
        },
      );
    });

    it('should handle streaming mode (render returns void)', async () => {
      const testData = { message: 'Streaming' };
      const viewPath = 'views/stream';

      // @Render decorator present
      vi.mocked(mockReflector.get).mockReturnValue(viewPath);

      // Mock handler returning data
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));

      // Mock render service returning void (streaming mode)
      vi.mocked(mockRenderService.render).mockResolvedValue(undefined);

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      const result = await firstValueFrom(result$);
      expect(result).toBeUndefined();
      expect(mockResponse.type).not.toHaveBeenCalled();
    });

    it('should build RenderContext from request headers', async () => {
      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      // @Render decorator present
      vi.mocked(mockReflector.get).mockReturnValue(viewPath);

      // Mock handler
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));

      // Mock render service
      vi.mocked(mockRenderService.render).mockResolvedValue('<html></html>');

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      expect(context.url).toBe('/test?page=1');
      expect(context.path).toBe('/test');
      expect(context.query).toEqual({ page: '1' });
      expect(context.params).toEqual({ id: '123' });
      expect(context.method).toBe('GET');
      // Note: headers like user-agent, accept-language, referer are only included
      // when explicitly configured via allowedHeaders
    });

    it('should handle missing headers gracefully', async () => {
      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      // Request with no optional headers
      mockRequest = {
        url: '/test',
        path: '/test',
        query: {},
        params: {},
        headers: {},
      } as Partial<Request>;

      mockExecutionContext = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ExecutionContext;

      // @Render decorator present
      vi.mocked(mockReflector.get).mockReturnValue(viewPath);

      // Mock handler
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));

      // Mock render service
      vi.mocked(mockRenderService.render).mockResolvedValue('<html></html>');

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      expect(context.userAgent).toBeUndefined();
      expect(context.acceptLanguage).toBeUndefined();
      expect(context.referer).toBeUndefined();
    });

    it('should re-throw errors from render service', async () => {
      const testData = { message: 'Test' };
      const viewPath = 'views/broken';
      const renderError = new Error('Render failed');

      // @Render decorator present
      vi.mocked(mockReflector.get).mockReturnValue(viewPath);

      // Mock handler
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));

      // Mock render service throwing error
      vi.mocked(mockRenderService.render).mockRejectedValue(renderError);

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await expect(firstValueFrom(result$)).rejects.toThrow('Render failed');
    });
  });

  describe('layout resolution', () => {
    const MockRootLayout = () => null;
    MockRootLayout.displayName = 'RootLayout';

    const MockMainLayout = () => null;
    MockMainLayout.displayName = 'MainLayout';

    const MockDashboardLayout = () => null;
    MockDashboardLayout.displayName = 'DashboardLayout';

    it('should include root layout in layout chain', async () => {
      const testData = { message: 'Hello' };
      const viewPath = 'views/test';

      // Mock root layout exists
      vi.mocked(mockRenderService.getRootLayout).mockResolvedValue(
        MockRootLayout,
      );

      // No controller or method layouts
      vi.mocked(mockReflector.get).mockImplementation((key: string) => {
        if (key === 'render') return viewPath;
        return undefined;
      });

      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const layouts = renderCall[1].__layouts;

      expect(layouts).toHaveLength(1);
      expect(layouts[0].layout).toBe(MockRootLayout);
    });

    it('should build full layout hierarchy: Root → Controller → Method → Page', async () => {
      const testData: RenderResponse = {
        props: { message: 'Dashboard' },
        layoutProps: { activeTab: 'overview' },
      };
      const viewPath = 'views/dashboard';

      // Mock root layout exists
      vi.mocked(mockRenderService.getRootLayout).mockResolvedValue(
        MockRootLayout,
      );

      // Mock controller layout
      vi.mocked(mockReflector.get).mockImplementation(
        (key: string, target: any) => {
          if (key === 'render') return viewPath;
          if (key === 'render_options') return { layout: MockDashboardLayout };
          if (key === 'layout') return { layout: MockMainLayout };
          return undefined;
        },
      );

      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Dashboard</html>',
      );

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const layouts = renderCall[1].__layouts;

      expect(layouts).toHaveLength(3);
      expect(layouts[0].layout).toBe(MockRootLayout);
      expect(layouts[1].layout).toBe(MockMainLayout);
      expect(layouts[2].layout).toBe(MockDashboardLayout);
    });

    it('should merge dynamic layoutProps into all layouts', async () => {
      const testData: RenderResponse = {
        props: { stats: { users: 100 } },
        layoutProps: {
          title: 'User Dashboard',
          subtitle: 'Welcome back',
          lastUpdated: '2:00 PM',
        },
      };
      const viewPath = 'views/dashboard';

      // Mock root layout exists
      vi.mocked(mockRenderService.getRootLayout).mockResolvedValue(
        MockRootLayout,
      );

      // Mock controller layout with static props
      vi.mocked(mockReflector.get).mockImplementation(
        (key: string, target: any) => {
          if (key === 'render') return viewPath;
          if (key === 'layout')
            return {
              layout: MockMainLayout,
              options: { props: { theme: 'light' } },
            };
          return undefined;
        },
      );

      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Dashboard</html>',
      );

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const layouts = renderCall[1].__layouts;

      // Root layout should receive dynamic props
      expect(layouts[0].props).toEqual({
        title: 'User Dashboard',
        subtitle: 'Welcome back',
        lastUpdated: '2:00 PM',
      });

      // Controller layout should receive static + dynamic props
      expect(layouts[1].props).toEqual({
        theme: 'light',
        title: 'User Dashboard',
        subtitle: 'Welcome back',
        lastUpdated: '2:00 PM',
      });
    });

    it('should skip all layouts when layout: null in @Render options', async () => {
      const testData = { message: 'Raw page' };
      const viewPath = 'views/raw';

      // Mock root layout exists
      vi.mocked(mockRenderService.getRootLayout).mockResolvedValue(
        MockRootLayout,
      );

      // Method-level override: layout: null
      vi.mocked(mockReflector.get).mockImplementation(
        (key: string, target: any) => {
          if (key === 'render') return viewPath;
          if (key === 'render_options') return { layout: null };
          if (key === 'layout') return { layout: MockMainLayout };
          return undefined;
        },
      );

      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue('<html>Raw</html>');

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const layouts = renderCall[1].__layouts;

      // Should have no layouts (null skips ALL layouts including root)
      expect(layouts).toHaveLength(0);
    });

    it('should skip controller layout but keep root when layout: false in @Render options', async () => {
      const testData = { message: 'Custom page' };
      const viewPath = 'views/custom';

      // Mock root layout exists
      vi.mocked(mockRenderService.getRootLayout).mockResolvedValue(
        MockRootLayout,
      );

      // Method-level override: layout: false
      vi.mocked(mockReflector.get).mockImplementation(
        (key: string, target: any) => {
          if (key === 'render') return viewPath;
          if (key === 'render_options') return { layout: false };
          if (key === 'layout') return { layout: MockMainLayout };
          return undefined;
        },
      );

      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Custom</html>',
      );

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const layouts = renderCall[1].__layouts;

      // Should only have root layout (false skips controller layout)
      expect(layouts).toHaveLength(1);
      expect(layouts[0].layout).toBe(MockRootLayout);
    });

    it('should handle when no root layout exists', async () => {
      const testData = { message: 'Hello' };
      const viewPath = 'views/test';

      // Mock root layout does not exist
      vi.mocked(mockRenderService.getRootLayout).mockResolvedValue(null);

      // Mock controller layout
      vi.mocked(mockReflector.get).mockImplementation(
        (key: string, target: any) => {
          if (key === 'render') return viewPath;
          if (key === 'layout') return { layout: MockMainLayout };
          return undefined;
        },
      );

      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const layouts = renderCall[1].__layouts;

      // Should only have controller layout
      expect(layouts).toHaveLength(1);
      expect(layouts[0].layout).toBe(MockMainLayout);
    });

    it('should merge static props from @Render decorator with dynamic layoutProps', async () => {
      const testData: RenderResponse = {
        props: { stats: { users: 100 } },
        layoutProps: {
          lastUpdated: '2:30 PM',
        },
      };
      const viewPath = 'views/dashboard';

      // Mock root layout exists
      vi.mocked(mockRenderService.getRootLayout).mockResolvedValue(
        MockRootLayout,
      );

      // Method-level layout with static layoutProps
      vi.mocked(mockReflector.get).mockImplementation(
        (key: string, target: any) => {
          if (key === 'render') return viewPath;
          if (key === 'render_options')
            return {
              layout: MockDashboardLayout,
              layoutProps: { activeTab: 'overview', showHeader: true },
            };
          return undefined;
        },
      );

      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Dashboard</html>',
      );

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const layouts = renderCall[1].__layouts;

      // Root layout gets dynamic props only
      expect(layouts[0].props).toEqual({
        lastUpdated: '2:30 PM',
      });

      // Method layout gets static + dynamic props merged
      expect(layouts[1].props).toEqual({
        activeTab: 'overview',
        showHeader: true,
        lastUpdated: '2:30 PM',
      });
    });
  });

  describe('real-world scenarios', () => {
    it('should handle blog post with SEO metadata', async () => {
      const blogPost: RenderResponse = {
        props: {
          post: {
            title: 'NestJS SSR Guide',
            content: 'This is a comprehensive guide...',
            author: 'John Doe',
          },
        },
        head: {
          title: 'NestJS SSR Guide - My Blog',
          description: 'Learn how to implement SSR with NestJS',
          keywords: 'nestjs, ssr, react, typescript',
          ogTitle: 'NestJS SSR Guide',
          ogDescription: 'Learn how to implement SSR with NestJS',
          ogImage: 'https://example.com/blog/nestjs-ssr.png',
        },
      };

      // @Render decorator
      vi.mocked(mockReflector.get).mockReturnValue('views/blog-post');

      // Mock handler
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(blogPost));

      // Mock render service
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html><title>NestJS SSR Guide - My Blog</title></html>',
      );

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const head = renderCall[3] as HeadData;

      expect(head.title).toBe('NestJS SSR Guide - My Blog');
      expect(head.description).toBe('Learn how to implement SSR with NestJS');
      expect(head.ogImage).toBe('https://example.com/blog/nestjs-ssr.png');
    });

    it('should handle user dashboard with authentication', async () => {
      const dashboardData = {
        user: {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com',
        },
        stats: {
          posts: 42,
          followers: 150,
        },
      };

      // @Render decorator
      vi.mocked(mockReflector.get).mockReturnValue('views/dashboard');

      // Mock handler
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(dashboardData));

      // Mock render service
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html><h1>Dashboard</h1></html>',
      );

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const data = renderCall[1].data;

      expect(data.user.name).toBe('John Doe');
      expect(data.stats.posts).toBe(42);
    });

    it('should handle product page with dynamic route params', async () => {
      // Request with product ID in params
      mockRequest = {
        url: '/products/laptop-123',
        path: '/products/laptop-123',
        query: {},
        params: { productId: 'laptop-123' },
        headers: {
          'user-agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        },
      } as Partial<Request>;

      mockExecutionContext = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ExecutionContext;

      const productData: RenderResponse = {
        props: {
          product: {
            id: 'laptop-123',
            name: 'MacBook Pro',
            price: 1999,
          },
        },
        head: {
          title: 'MacBook Pro - Online Store',
          description: 'Buy MacBook Pro at the best price',
        },
      };

      // @Render decorator
      vi.mocked(mockReflector.get).mockReturnValue('views/product');

      // Mock handler
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(productData));

      // Mock render service
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html><h1>MacBook Pro</h1></html>',
      );

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      expect(context.params.productId).toBe('laptop-123');
      expect(context.path).toBe('/products/laptop-123');
    });

    it('should handle search page with query parameters', async () => {
      // Request with search query
      mockRequest = {
        url: '/search?q=nestjs&category=tutorials&tags=react&tags=ssr',
        path: '/search',
        query: {
          q: 'nestjs',
          category: 'tutorials',
          tags: ['react', 'ssr'],
        },
        params: {},
        headers: {},
      } as Partial<Request>;

      mockExecutionContext = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ExecutionContext;

      const searchResults = {
        results: [{ title: 'NestJS Tutorial' }, { title: 'React SSR Guide' }],
        total: 2,
      };

      // @Render decorator
      vi.mocked(mockReflector.get).mockReturnValue('views/search');

      // Mock handler
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(searchResults));

      // Mock render service
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html><h1>Search Results</h1></html>',
      );

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      expect(context.query.q).toBe('nestjs');
      expect(context.query.category).toBe('tutorials');
      expect(context.query.tags).toEqual(['react', 'ssr']);
    });
  });

  describe('allowedHeaders and allowedCookies', () => {
    it('should include allowed headers in context', async () => {
      // Create interceptor with allowedHeaders
      const interceptorWithHeaders = new RenderInterceptor(
        mockReflector,
        mockRenderService,
        ['x-tenant-id', 'x-api-version'],
        [],
      );

      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptorWithHeaders.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      // Should include allowed headers
      expect(context['x-tenant-id']).toBe('tenant-123');
      expect(context['x-api-version']).toBe('v2');
      // Should have basic context properties
      expect(context.url).toBeDefined();
      expect(context.method).toBeDefined();
    });

    it('should include allowed cookies in context', async () => {
      // Create interceptor with allowedCookies
      const interceptorWithCookies = new RenderInterceptor(
        mockReflector,
        mockRenderService,
        [],
        ['theme', 'locale'],
      );

      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptorWithCookies.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      // Should include allowed cookies
      expect(context.cookies).toEqual({ theme: 'dark', locale: 'en-US' });
    });

    it('should include both allowed headers and cookies in context', async () => {
      // Create interceptor with both
      const interceptorWithBoth = new RenderInterceptor(
        mockReflector,
        mockRenderService,
        ['x-tenant-id'],
        ['theme'],
      );

      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptorWithBoth.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      // Should include both
      expect(context['x-tenant-id']).toBe('tenant-123');
      expect(context.cookies).toEqual({ theme: 'dark' });
    });

    it('should not include headers/cookies when not configured', async () => {
      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      // Should not include custom headers
      expect(context['x-tenant-id']).toBeUndefined();
      expect(context['x-api-version']).toBeUndefined();
      // Should not include cookies property
      expect(context.cookies).toBeUndefined();
      // Should only have base context properties
      expect(context.url).toBeDefined();
      expect(context.method).toBeDefined();
      expect(context.params).toBeDefined();
      expect(context.query).toBeDefined();
    });

    it('should handle missing headers/cookies gracefully', async () => {
      const interceptorWithConfig = new RenderInterceptor(
        mockReflector,
        mockRenderService,
        ['x-missing-header'],
        ['missing-cookie'],
      );

      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptorWithConfig.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      // Missing headers should not be added to context
      expect(context['x-missing-header']).toBeUndefined();
      // Missing cookies should result in no cookies property (empty object not added)
      expect(context.cookies).toBeUndefined();
    });

    it('should handle array header values', async () => {
      // Create modified mock request with array header value
      const mockRequestWithArrayHeader = {
        ...mockExecutionContext.switchToHttp().getRequest(),
        headers: {
          ...mockExecutionContext.switchToHttp().getRequest().headers,
          'x-forwarded-for': ['192.168.1.1', '10.0.0.1'],
        },
      };

      const modifiedContext = {
        ...mockExecutionContext,
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: () => mockRequestWithArrayHeader,
          getResponse: () => mockResponse,
        }),
      };

      const interceptorWithHeaders = new RenderInterceptor(
        mockReflector,
        mockRenderService,
        ['x-forwarded-for'],
        [],
      );

      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptorWithHeaders.intercept(
        modifiedContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      // Array values should be joined with comma-space
      expect(context['x-forwarded-for']).toBe('192.168.1.1, 10.0.0.1');
    });
  });

  describe('context factory', () => {
    it('should call context factory and merge result into context', async () => {
      const mockUser = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      const contextFactory = vi.fn().mockReturnValue({ user: mockUser });

      const interceptorWithContext = new RenderInterceptor(
        mockReflector,
        mockRenderService as unknown as RenderService,
        [],
        [],
        contextFactory,
      );

      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptorWithContext.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      // Verify context factory was called with request
      expect(contextFactory).toHaveBeenCalledWith({ req: mockRequest });

      // Verify user is in context
      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;
      expect(context.user).toEqual(mockUser);
      // Base context should still be present
      expect(context.url).toBe('/test?page=1');
      expect(context.method).toBe('GET');
    });

    it('should support async context factory', async () => {
      const mockUser = { id: '456', name: 'Jane Doe' };
      const mockPermissions = ['read', 'write'];
      const asyncContextFactory = vi.fn().mockResolvedValue({
        user: mockUser,
        permissions: mockPermissions,
      });

      const interceptorWithAsyncContext = new RenderInterceptor(
        mockReflector,
        mockRenderService as unknown as RenderService,
        [],
        [],
        asyncContextFactory,
      );

      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptorWithAsyncContext.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;
      expect(context.user).toEqual(mockUser);
      expect(context.permissions).toEqual(mockPermissions);
    });

    it('should merge context factory result with headers and cookies', async () => {
      const mockUser = { id: '789', name: 'Bob' };
      const contextFactory = vi.fn().mockReturnValue({ user: mockUser });

      const interceptorWithAll = new RenderInterceptor(
        mockReflector,
        mockRenderService as unknown as RenderService,
        ['x-tenant-id'],
        ['theme'],
        contextFactory,
      );

      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptorWithAll.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      // All should be present
      expect(context.user).toEqual(mockUser);
      expect(context['x-tenant-id']).toBe('tenant-123');
      expect(context.cookies).toEqual({ theme: 'dark' });
      expect(context.url).toBe('/test?page=1');
    });

    it('should handle context factory returning null', async () => {
      const contextFactory = vi.fn().mockReturnValue(null);

      const interceptorWithNullContext = new RenderInterceptor(
        mockReflector,
        mockRenderService as unknown as RenderService,
        [],
        [],
        contextFactory,
      );

      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptorWithNullContext.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      // Should not throw, base context should still work
      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;
      expect(context.url).toBe('/test?page=1');
      expect(context.method).toBe('GET');
    });

    it('should handle context factory returning undefined', async () => {
      const contextFactory = vi.fn().mockReturnValue(undefined);

      const interceptorWithUndefinedContext = new RenderInterceptor(
        mockReflector,
        mockRenderService as unknown as RenderService,
        [],
        [],
        contextFactory,
      );

      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptorWithUndefinedContext.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      // Should not throw, base context should still work
      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;
      expect(context.url).toBe('/test?page=1');
    });

    it('should work without context factory (default behavior)', async () => {
      // interceptor without context factory (existing behavior)
      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      // Base context should be present
      expect(context.url).toBe('/test?page=1');
      expect(context.method).toBe('GET');
      expect(context.params).toEqual({ id: '123' });
      // No custom properties
      expect(context.user).toBeUndefined();
    });

    it('should allow context factory to access request.user from Passport', async () => {
      // Simulate Passport attaching user to request
      const passportUser = { id: 'passport-user', roles: ['admin'] };
      const mockRequestWithUser = {
        ...mockRequest,
        user: passportUser,
      };

      const modifiedContext = {
        ...mockExecutionContext,
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: () => mockRequestWithUser,
          getResponse: () => mockResponse,
        }),
      };

      const contextFactory = vi.fn().mockImplementation(({ req }) => ({
        user: req.user,
        isAdmin: req.user?.roles?.includes('admin'),
      }));

      const interceptorWithPassport = new RenderInterceptor(
        mockReflector,
        mockRenderService as unknown as RenderService,
        [],
        [],
        contextFactory,
      );

      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptorWithPassport.intercept(
        modifiedContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      expect(context.user).toEqual(passportUser);
      expect(context.isAdmin).toBe(true);
    });
  });

  describe('Fastify adapter compatibility', () => {
    /**
     * Helper to create a Fastify-shaped mock request (no .path property).
     * Fastify uses .url but not .path — unlike Express which has both.
     */
    function createFastifyRequest(overrides: Record<string, any> = {}) {
      return {
        url: '/test?page=1',
        method: 'GET',
        query: { page: '1' },
        params: { id: '123' },
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
        // No .path — Fastify doesn't set it
        // No .cookies — requires @fastify/cookie plugin
        ...overrides,
      };
    }

    function createFastifyExecutionContext(
      request: Record<string, any>,
    ): ExecutionContext {
      return {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: () => request,
          getResponse: () => mockResponse,
        }),
      } as unknown as ExecutionContext;
    }

    it('should extract path from url when request.path is missing', async () => {
      const fastifyRequest = createFastifyRequest({
        url: '/test?page=1',
      });
      const fastifyContext = createFastifyExecutionContext(fastifyRequest);

      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptor.intercept(
        fastifyContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      expect(context.path).toBe('/test');
      expect(context.url).toBe('/test?page=1');
    });

    it('should handle url without query string when request.path is missing', async () => {
      const fastifyRequest = createFastifyRequest({
        url: '/about',
        query: {},
        params: {},
      });
      const fastifyContext = createFastifyExecutionContext(fastifyRequest);

      const testData = { title: 'About' };
      const viewPath = 'views/about';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>About</html>',
      );

      const result$ = interceptor.intercept(
        fastifyContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      expect(context.path).toBe('/about');
    });

    it('should handle undefined cookies gracefully', async () => {
      // Fastify doesn't attach .cookies without @fastify/cookie plugin
      const fastifyRequest = createFastifyRequest();
      const fastifyContext = createFastifyExecutionContext(fastifyRequest);

      const interceptorWithCookies = new RenderInterceptor(
        mockReflector,
        mockRenderService as unknown as RenderService,
        [],
        ['theme', 'locale'],
      );

      const testData = { message: 'Test' };
      const viewPath = 'views/test';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Test</html>',
      );

      const result$ = interceptorWithCookies.intercept(
        fastifyContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      // Should not throw and cookies should not be in context
      expect(context.cookies).toBeUndefined();
      expect(context.url).toBeDefined();
    });

    it('should work with context factory when request has no .path', async () => {
      const fastifyRequest = createFastifyRequest({
        url: '/dashboard?tab=overview',
        query: { tab: 'overview' },
        user: { id: 'user-1', name: 'Alice' },
      });
      const fastifyContext = createFastifyExecutionContext(fastifyRequest);

      const contextFactory = vi.fn().mockImplementation(({ req }) => ({
        user: req.user,
      }));

      const interceptorWithFactory = new RenderInterceptor(
        mockReflector,
        mockRenderService as unknown as RenderService,
        [],
        [],
        contextFactory,
      );

      const testData = { stats: {} };
      const viewPath = 'views/dashboard';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Dashboard</html>',
      );

      const result$ = interceptorWithFactory.intercept(
        fastifyContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      expect(contextFactory).toHaveBeenCalledWith({ req: fastifyRequest });

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      expect(context.path).toBe('/dashboard');
      expect(context.user).toEqual({ id: 'user-1', name: 'Alice' });
    });

    it('should extract nested path from url with query string', async () => {
      const fastifyRequest = createFastifyRequest({
        url: '/users/123?tab=profile',
        query: { tab: 'profile' },
        params: { id: '123' },
      });
      const fastifyContext = createFastifyExecutionContext(fastifyRequest);

      const testData = { user: { id: '123' } };
      const viewPath = 'views/user-profile';

      vi.mocked(mockReflector.get).mockReturnValue(viewPath);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(testData));
      vi.mocked(mockRenderService.render).mockResolvedValue(
        '<html>Profile</html>',
      );

      const result$ = interceptor.intercept(
        fastifyContext,
        mockCallHandler as CallHandler,
      );

      await firstValueFrom(result$);

      const renderCall = vi.mocked(mockRenderService.render).mock.calls[0];
      const context = renderCall[1].__context;

      expect(context.path).toBe('/users/123');
      expect(context.params).toEqual({ id: '123' });
      expect(context.query).toEqual({ tab: 'profile' });
    });
  });
});
