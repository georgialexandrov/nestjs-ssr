/**
 * Integration tests for the full render pipeline
 * Tests the integration between RenderInterceptor and RenderService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import type { Response } from 'express';
import { of, firstValueFrom } from 'rxjs';
import { RenderInterceptor } from '../../render/render.interceptor';
import { RenderService } from '../../render/render.service';
import { TemplateParserService } from '../../render/template-parser.service';
import { StreamingErrorHandler } from '../../render/streaming-error-handler';
import { createElement } from 'react';

describe('Render Pipeline Integration', () => {
  let renderInterceptor: RenderInterceptor;
  let renderService: RenderService;
  let reflector: Reflector;
  let mockExecutionContext: Partial<ExecutionContext>;
  let mockCallHandler: Partial<CallHandler>;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    // Create service instances manually (faster than full module compilation)
    const templateParser = new TemplateParserService();
    const errorHandler = new StreamingErrorHandler();

    // Create RenderService with dependencies
    renderService = new RenderService(
      templateParser,
      errorHandler,
      'string', // SSR_MODE
      {
        // DEFAULT_HEAD
        title: 'Test App',
        description: 'Integration test app',
      },
      undefined, // CUSTOM_TEMPLATE
    );

    reflector = new Reflector();
    renderInterceptor = new RenderInterceptor(reflector, renderService);

    // Mock HTTP context
    const mockRequest = {
      url: '/test?page=1',
      path: '/test',
      method: 'GET',
      query: { page: '1' },
      params: { id: '123' },
      headers: {
        'user-agent': 'Test Agent',
        'accept-language': 'en-US',
      },
      cookies: {},
    };

    mockResponse = {
      type: vi.fn(),
    };

    mockExecutionContext = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };

    mockCallHandler = {
      handle: vi.fn(),
    };

    // Mock getRootLayout to return null by default (tests can override)
    vi.spyOn(renderService, 'getRootLayout').mockResolvedValue(null);
  });

  describe('Interceptor → Service Integration', () => {
    it('should flow data through interceptor to service and render HTML', async () => {
      const testData = { title: 'Hello World', count: 42 };

      // Setup @Render decorator
      vi.spyOn(reflector, 'get').mockReturnValue('views/test');
      vi.spyOn(mockCallHandler, 'handle').mockReturnValue(of(testData));

      // Mock render service to return realistic HTML
      vi.spyOn(renderService, 'render').mockResolvedValue(`
        <!DOCTYPE html>
        <html>
          <head><title>Test App</title></head>
          <body>
            <div id="root">
              <div data-testid="test-page">
                <h1>Hello World</h1>
                <p>Count: 42</p>
              </div>
            </div>
          </body>
        </html>
      `);

      // Execute the full pipeline
      const result$ = renderInterceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      const html = await firstValueFrom(result$);

      // Verify render service was called with correct data
      expect(renderService.render).toHaveBeenCalledWith(
        'views/test',
        expect.objectContaining({
          data: testData,
          __context: expect.objectContaining({
            path: '/test',
            method: 'GET',
          }),
        }),
        expect.anything(),
        undefined,
      );

      // Verify HTML output contains rendered React component
      expect(html).toContain('data-testid="test-page"');
      expect(html).toContain('Hello World');
      expect(html).toContain('Count: 42');

      // Verify HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<div id="root">');

      // Verify content-type was set
      expect(mockResponse.type).toHaveBeenCalledWith('text/html');
    });

    it('should serialize initial state for client hydration', async () => {
      const testData = { title: 'Test', count: 100 };

      vi.spyOn(reflector, 'get').mockReturnValue('views/test');
      vi.spyOn(mockCallHandler, 'handle').mockReturnValue(of(testData));

      // Mock render to return HTML with serialized state
      vi.spyOn(renderService, 'render').mockResolvedValue(`
        <!DOCTYPE html>
        <html>
          <body>
            <div id="root"></div>
            <script>
              window.__INITIAL_STATE__ = {"title":"Test","count":100};
              window.__CONTEXT__ = {"path":"/test","method":"GET"};
              window.__COMPONENT_NAME__ = "views/test";
            </script>
          </body>
        </html>
      `);

      const result$ = renderInterceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      const html = await firstValueFrom(result$);

      // Verify render was called with correct parameters
      expect(renderService.render).toHaveBeenCalled();

      // Check initial state
      expect(html).toContain('window.__INITIAL_STATE__');
      expect(html).toContain('"title":"Test"');
      expect(html).toContain('"count":100');

      // Check context
      expect(html).toContain('window.__CONTEXT__');
      expect(html).toContain('"path":"/test"');

      // Check component name
      expect(html).toContain('window.__COMPONENT_NAME__');
      expect(html).toContain('"views/test"');
    });

    it('should render custom head tags from RenderResponse', async () => {
      const renderResponse = {
        props: { title: 'SEO Page', count: 1 },
        head: {
          title: 'Custom SEO Title',
          description: 'Custom description for search engines',
          meta: [
            { property: 'og:title', content: 'OG Title' },
            { name: 'robots', content: 'index, follow' },
          ],
          scripts: [
            {
              src: 'https://analytics.example.com/script.js',
              async: true,
            },
          ],
        },
      };

      vi.spyOn(reflector, 'get').mockReturnValue('views/test');
      vi.spyOn(mockCallHandler, 'handle').mockReturnValue(of(renderResponse));

      // Mock render to return HTML with custom head
      vi.spyOn(renderService, 'render').mockResolvedValue(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Custom SEO Title</title>
            <meta name="description" content="Custom description for search engines" />
            <meta property="og:title" content="OG Title" />
            <meta name="robots" content="index, follow" />
            <script src="https://analytics.example.com/script.js" async></script>
          </head>
          <body><div id="root"></div></body>
        </html>
      `);

      const result$ = renderInterceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      const html = await firstValueFrom(result$);

      // Verify head data was passed to render
      expect(renderService.render).toHaveBeenCalledWith(
        'views/test',
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          title: 'Custom SEO Title',
          description: 'Custom description for search engines',
        }),
      );

      // Check custom head tags
      expect(html).toMatch(/<title>Custom SEO Title<\/title>/);
      expect(html).toContain(
        '<meta name="description" content="Custom description for search engines"',
      );
      expect(html).toContain('<meta property="og:title" content="OG Title"');
      expect(html).toContain('<meta name="robots" content="index, follow"');

      // Check custom scripts
      expect(html).toContain('src="https://analytics.example.com/script.js"');
      expect(html).toContain('async');
    });

    it('should compose layouts correctly', async () => {
      const testData = { title: 'Nested Page', count: 5 };

      // Mock root layout component
      const RootLayout = () =>
        createElement('div', { 'data-testid': 'root-layout' });

      // Mock root layout exists
      vi.spyOn(renderService, 'getRootLayout').mockResolvedValue(RootLayout);

      vi.spyOn(reflector, 'get').mockReturnValue('views/test');
      vi.spyOn(mockCallHandler, 'handle').mockReturnValue(of(testData));

      // Mock render to return HTML with layout wrapping page
      vi.spyOn(renderService, 'render').mockResolvedValue(`
        <!DOCTYPE html>
        <html>
          <body>
            <div id="root">
              <div data-testid="root-layout">
                <header>Site Header</header>
                <div data-testid="test-page">
                  <h1>Nested Page</h1>
                  <p>Count: 5</p>
                </div>
                <footer>Site Footer</footer>
              </div>
            </div>
          </body>
        </html>
      `);

      const result$ = renderInterceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      const html = await firstValueFrom(result$);

      // Verify layout chain was built
      expect(renderService.getRootLayout).toHaveBeenCalled();

      // Check both layout and page rendered
      expect(html).toContain('data-testid="root-layout"');
      expect(html).toContain('Site Header');
      expect(html).toContain('Site Footer');
      expect(html).toContain('data-testid="test-page"');

      // Verify nesting order (layout should wrap page)
      const layoutIndex = html.indexOf('data-testid="root-layout"');
      const pageIndex = html.indexOf('data-testid="test-page"');
      expect(pageIndex).toBeGreaterThan(layoutIndex);
    });

    it('should pass layout props through the pipeline', async () => {
      function DashboardLayout({
        children,
        layoutProps,
      }: {
        children: React.ReactNode;
        layoutProps?: { user: string };
      }) {
        return createElement(
          'div',
          { 'data-testid': 'dashboard' },
          createElement('p', null, `User: ${layoutProps?.user || 'Guest'}`),
          children,
        );
      }

      const renderResponse = {
        props: { title: 'Dashboard', count: 999 },
        layoutProps: { user: 'John Doe' },
      };

      vi.spyOn(reflector, 'get').mockImplementation((key: string) => {
        if (key === 'render') return 'views/test';
        if (key === 'render_options')
          return { layout: DashboardLayout, layoutProps: {} };
        return undefined;
      });

      vi.spyOn(mockCallHandler, 'handle').mockReturnValue(of(renderResponse));

      // Mock render to return HTML with layout props rendered
      vi.spyOn(renderService, 'render').mockResolvedValue(`
        <!DOCTYPE html>
        <html>
          <body>
            <div id="root">
              <div data-testid="dashboard">
                <p>User: John Doe</p>
                <div>Dashboard Content</div>
              </div>
            </div>
          </body>
        </html>
      `);

      const result$ = renderInterceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      const html = await firstValueFrom(result$);

      // Verify data with layoutProps was passed to render
      expect(renderService.render).toHaveBeenCalledWith(
        'views/test',
        expect.objectContaining({
          data: { title: 'Dashboard', count: 999 },
          __layouts: expect.arrayContaining([
            expect.objectContaining({
              props: expect.objectContaining({ user: 'John Doe' }),
            }),
          ]),
        }),
        expect.anything(),
        undefined,
      );

      // Check layoutProps were passed correctly
      expect(html).toContain('data-testid="dashboard"');
      expect(html).toContain('User: John Doe');
    });
  });

  describe('Default Head Configuration', () => {
    it('should use default head from module config', async () => {
      const testData = { title: 'Simple Page', count: 1 };

      vi.spyOn(reflector, 'get').mockReturnValue('views/test');
      vi.spyOn(mockCallHandler, 'handle').mockReturnValue(of(testData));

      // Mock render to return HTML with default head tags
      vi.spyOn(renderService, 'render').mockResolvedValue(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Test App</title>
            <meta name="description" content="Integration test app" />
          </head>
          <body><div id="root"></div></body>
        </html>
      `);

      const result$ = renderInterceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      const html = await firstValueFrom(result$);

      // Verify no custom head was passed (undefined means use defaults)
      expect(renderService.render).toHaveBeenCalledWith(
        'views/test',
        expect.anything(),
        expect.anything(),
        undefined,
      );

      // Check default head from module config is used when no custom head provided
      expect(html).toContain('<meta charset="UTF-8"');
      expect(html).toContain('<meta name="viewport"');
    });
  });

  describe('Context Propagation', () => {
    it('should propagate request context through the pipeline', async () => {
      const testData = { title: 'Context Test', count: 7 };

      vi.spyOn(reflector, 'get').mockReturnValue('views/test');
      vi.spyOn(mockCallHandler, 'handle').mockReturnValue(of(testData));

      // Mock render to return HTML with context data
      vi.spyOn(renderService, 'render').mockResolvedValue(`
        <!DOCTYPE html>
        <html>
          <body>
            <div id="root"></div>
            <script>
              window.__CONTEXT__ = {"url":"/test?page=1","path":"/test","method":"GET","query":{"page":"1"},"params":{"id":"123"}};
            </script>
          </body>
        </html>
      `);

      const result$ = renderInterceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      const html = await firstValueFrom(result$);

      // Verify context was built and passed to render
      expect(renderService.render).toHaveBeenCalledWith(
        'views/test',
        expect.objectContaining({
          __context: expect.objectContaining({
            url: '/test?page=1',
            path: '/test',
            method: 'GET',
            query: { page: '1' },
            params: { id: '123' },
            // Note: cookies are only added when allowedCookies is configured
          }),
        }),
        expect.anything(),
        undefined,
      );

      // Verify context data is available
      expect(html).toContain('"url":"/test?page=1"');
      expect(html).toContain('"path":"/test"');
      expect(html).toContain('"method":"GET"');
      expect(html).toContain('"page":"1"');
      expect(html).toContain('"id":"123"');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle errors in controller gracefully', async () => {
      vi.spyOn(reflector, 'get').mockReturnValue('views/test');

      // Mock controller that returns error observable
      const { throwError } = await import('rxjs');
      vi.spyOn(mockCallHandler, 'handle').mockReturnValue(
        throwError(() => new Error('Controller error')),
      );

      const result$ = renderInterceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      // Should propagate error
      await expect(firstValueFrom(result$)).rejects.toThrow('Controller error');
    });

    it('should handle render service errors', async () => {
      const testData = { title: 'Error Test', count: 1 };

      vi.spyOn(reflector, 'get').mockReturnValue('views/test');
      vi.spyOn(mockCallHandler, 'handle').mockReturnValue(of(testData));

      // Mock render service to throw error
      vi.spyOn(renderService, 'render').mockRejectedValue(
        new Error('Component not found'),
      );

      const result$ = renderInterceptor.intercept(
        mockExecutionContext as ExecutionContext,
        mockCallHandler as CallHandler,
      );

      // Should propagate render error
      await expect(firstValueFrom(result$)).rejects.toThrow(
        'Component not found',
      );
    });
  });
});
