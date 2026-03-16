import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { RenderInterceptor } from '../render.interceptor';
import { Reflector } from '@nestjs/core';
import { RenderService } from '../render.service';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import type { Request, Response } from 'express';
import { of, firstValueFrom } from 'rxjs';
import {
  RENDER_KEY,
  RENDER_OPTIONS_KEY,
} from '../../decorators/react-render.decorator';

describe('RenderInterceptor — JSON API mode', () => {
  let mockReflector: Reflector;
  let mockRenderService: {
    render: ReturnType<typeof vi.fn>;
    getRootLayout: ReturnType<typeof vi.fn>;
  };
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  const TestComponent = () => null;
  TestComponent.displayName = 'TestComponent';

  beforeEach(() => {
    mockReflector = {
      get: vi.fn(),
    } as unknown as Reflector;

    mockRenderService = {
      render: vi.fn(),
      getRootLayout: vi.fn().mockResolvedValue(null),
    };

    mockRequest = {
      url: '/test',
      path: '/test',
      method: 'GET',
      query: {},
      params: {},
      headers: {},
    } as unknown as Request;

    mockResponse = {
      type: vi.fn(),
    } as Partial<Response>;

    mockExecutionContext = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: vi.fn(),
    } as unknown as CallHandler;
  });

  function createInterceptor(jsonApiEnabled?: boolean) {
    return new RenderInterceptor(
      mockReflector,
      mockRenderService as unknown as RenderService,
      undefined, // allowedHeaders
      undefined, // allowedCookies
      undefined, // contextFactory
      jsonApiEnabled,
    );
  }

  function setupRenderDecorator(options?: Record<string, any>) {
    vi.mocked(mockReflector.get).mockImplementation((key: unknown) => {
      if (key === RENDER_KEY) return TestComponent;
      if (key === RENDER_OPTIONS_KEY) return options;
      return undefined;
    });
  }

  function createFastifyExecutionContext(request: Record<string, any>) {
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: () => request,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  }

  describe('isJsonRequest', () => {
    it('should detect Accept: application/json', async () => {
      const interceptor = createInterceptor(true);
      setupRenderDecorator();
      mockRequest.headers = { accept: 'application/json' };
      const controllerData = { recipes: ['tarator'] };
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(controllerData));

      const result = await firstValueFrom(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      );

      expect(result).toEqual(controllerData);
      expect(mockResponse.type).toHaveBeenCalledWith('application/json');
    });

    it('should detect Accept with multiple types including application/json', async () => {
      const interceptor = createInterceptor(true);
      setupRenderDecorator();
      mockRequest.headers = {
        accept: 'text/html, application/json;q=0.9',
      };
      const controllerData = { id: 1 };
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(controllerData));

      const result = await firstValueFrom(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      );

      expect(result).toEqual(controllerData);
    });

    it('should not treat Accept: text/html as JSON request', async () => {
      const interceptor = createInterceptor(true);
      setupRenderDecorator();
      mockRequest.headers = { accept: 'text/html' };
      vi.mocked(mockCallHandler.handle).mockReturnValue(of({ message: 'hi' }));
      mockRenderService.render.mockResolvedValue('<html>hi</html>');

      const result = await firstValueFrom(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      );

      expect(result).toBe('<html>hi</html>');
      expect(mockRenderService.render).toHaveBeenCalled();
    });

    it('should not treat missing Accept header as JSON request', async () => {
      const interceptor = createInterceptor(true);
      setupRenderDecorator();
      mockRequest.headers = {};
      vi.mocked(mockCallHandler.handle).mockReturnValue(of({ message: 'hi' }));
      mockRenderService.render.mockResolvedValue('<html>hi</html>');

      const result = await firstValueFrom(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      );

      expect(result).toBe('<html>hi</html>');
    });
  });

  describe('isJsonApiEnabled — config resolution', () => {
    it('should use route-level jsonApi: true over module-level false', async () => {
      const interceptor = createInterceptor(false);
      setupRenderDecorator({ jsonApi: true });
      mockRequest.headers = { accept: 'application/json' };
      const controllerData = { enabled: true };
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(controllerData));

      const result = await firstValueFrom(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      );

      expect(result).toEqual(controllerData);
    });

    it('should use route-level jsonApi: false over module-level true', async () => {
      const interceptor = createInterceptor(true);
      setupRenderDecorator({ jsonApi: false });
      mockRequest.headers = { accept: 'application/json' };
      vi.mocked(mockCallHandler.handle).mockReturnValue(of({ data: 1 }));

      await expect(
        firstValueFrom(
          interceptor.intercept(mockExecutionContext, mockCallHandler),
        ),
      ).rejects.toThrow(HttpException);
    });

    it('should fall back to module-level when route has no jsonApi option', async () => {
      const interceptor = createInterceptor(true);
      setupRenderDecorator({}); // no jsonApi in options
      mockRequest.headers = { accept: 'application/json' };
      const controllerData = { fallback: true };
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(controllerData));

      const result = await firstValueFrom(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      );

      expect(result).toEqual(controllerData);
    });

    it('should default to false when neither route nor module sets jsonApi', async () => {
      const interceptor = createInterceptor(); // no jsonApiEnabled
      setupRenderDecorator(); // no options
      mockRequest.headers = { accept: 'application/json' };
      vi.mocked(mockCallHandler.handle).mockReturnValue(of({ data: 1 }));

      await expect(
        firstValueFrom(
          interceptor.intercept(mockExecutionContext, mockCallHandler),
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('JSON response shape', () => {
    it('should return raw controller data without wrapper', async () => {
      const interceptor = createInterceptor(true);
      setupRenderDecorator();
      mockRequest.headers = { accept: 'application/json' };
      const controllerData = { recipes: [{ name: 'tarator' }], total: 42 };
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(controllerData));

      const result = await firstValueFrom(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      );

      expect(result).toEqual(controllerData);
      expect(result).not.toHaveProperty('data');
      expect(result).not.toHaveProperty('meta');
    });

    it('should extract props from RenderResponse format', async () => {
      const interceptor = createInterceptor(true);
      setupRenderDecorator();
      mockRequest.headers = { accept: 'application/json' };
      // Controller returns RenderResponse format
      const controllerData = {
        props: { recipes: ['lohikeitto'] },
        head: { title: 'Recipes' },
      };
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(controllerData));

      const result = await firstValueFrom(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      );

      // Should return just the props, not the head/wrapper
      expect(result).toEqual({ recipes: ['lohikeitto'] });
    });
  });

  describe('406 Not Acceptable', () => {
    it('should throw 406 when jsonApi disabled globally', async () => {
      const interceptor = createInterceptor(false);
      setupRenderDecorator();
      mockRequest.headers = { accept: 'application/json' };
      vi.mocked(mockCallHandler.handle).mockReturnValue(of({ data: 1 }));

      await expect(
        firstValueFrom(
          interceptor.intercept(mockExecutionContext, mockCallHandler),
        ),
      ).rejects.toThrow(HttpException);
    });

    it('should include correct error message in 406', async () => {
      const interceptor = createInterceptor(false);
      setupRenderDecorator();
      mockRequest.headers = { accept: 'application/json' };
      vi.mocked(mockCallHandler.handle).mockReturnValue(of({ data: 1 }));

      try {
        await firstValueFrom(
          interceptor.intercept(mockExecutionContext, mockCallHandler),
        );
        expect.unreachable('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.NOT_ACCEPTABLE);
        expect(err.getResponse()).toEqual({
          error: 'Not Acceptable',
          message: 'JSON response not available for this route',
        });
      }
    });
  });

  describe('segment request priority', () => {
    it('should treat X-Current-Layouts as segment even with Accept: application/json', async () => {
      const interceptor = createInterceptor(true);
      setupRenderDecorator();
      mockRequest.headers = {
        accept: 'application/json',
        'x-current-layouts': 'RootLayout',
      };
      vi.mocked(mockCallHandler.handle).mockReturnValue(
        of({ message: 'segment' }),
      );

      // Segment path returns { swapTarget: null } when no common ancestor
      mockRenderService.getRootLayout.mockResolvedValue(null);

      const result = await firstValueFrom(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      );

      // Should NOT be the raw JSON — should go through segment path
      // With no layouts, determineSwapTarget returns null → { swapTarget: null }
      expect(result).toEqual({ swapTarget: null });
      expect(mockResponse.type).toHaveBeenCalledWith('application/json');
    });
  });

  describe('HTML rendering unchanged', () => {
    it('should render HTML normally when Accept header absent', async () => {
      const interceptor = createInterceptor(true); // jsonApi enabled
      setupRenderDecorator();
      mockRequest.headers = {};
      vi.mocked(mockCallHandler.handle).mockReturnValue(
        of({ message: 'hello' }),
      );
      mockRenderService.render.mockResolvedValue('<html>hello</html>');

      const result = await firstValueFrom(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      );

      expect(result).toBe('<html>hello</html>');
      expect(mockRenderService.render).toHaveBeenCalled();
    });

    it('should render HTML normally when Accept is text/html', async () => {
      const interceptor = createInterceptor(true);
      setupRenderDecorator();
      mockRequest.headers = { accept: 'text/html' };
      vi.mocked(mockCallHandler.handle).mockReturnValue(of({ count: 5 }));
      mockRenderService.render.mockResolvedValue('<html>5</html>');

      const result = await firstValueFrom(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      );

      expect(result).toBe('<html>5</html>');
    });
  });

  describe('Fastify adapter compatibility', () => {
    it('should return JSON for Fastify-shaped requests when enabled', async () => {
      const interceptor = createInterceptor(true);
      setupRenderDecorator();

      const fastifyRequest = {
        url: '/recipes?limit=1',
        method: 'GET',
        query: { limit: '1' },
        params: {},
        headers: { accept: 'application/json' },
      };

      const fastifyContext = createFastifyExecutionContext(fastifyRequest);
      const controllerData = { recipes: [{ name: 'tarator' }], total: 1 };
      vi.mocked(mockCallHandler.handle).mockReturnValue(of(controllerData));

      const result = await firstValueFrom(
        interceptor.intercept(fastifyContext, mockCallHandler),
      );

      expect(result).toEqual(controllerData);
      expect(mockResponse.type).toHaveBeenCalledWith('application/json');
      expect(mockRenderService.render).not.toHaveBeenCalled();
    });

    it('should return the exact 406 payload for Fastify-shaped requests when disabled', async () => {
      const interceptor = createInterceptor(false);
      setupRenderDecorator();

      const fastifyRequest = {
        url: '/recipes',
        method: 'GET',
        query: {},
        params: {},
        headers: { accept: 'application/json' },
      };

      const fastifyContext = createFastifyExecutionContext(fastifyRequest);
      vi.mocked(mockCallHandler.handle).mockReturnValue(of({ recipes: [] }));

      try {
        await firstValueFrom(
          interceptor.intercept(fastifyContext, mockCallHandler),
        );
        expect.unreachable('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.NOT_ACCEPTABLE);
        expect(err.getResponse()).toEqual({
          error: 'Not Acceptable',
          message: 'JSON response not available for this route',
        });
      }
    });
  });
});
