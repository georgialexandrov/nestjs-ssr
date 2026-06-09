import { describe, it, expect, beforeEach, vi } from 'vitest';
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
import { LAYOUT_KEY } from '../../decorators/layout.decorator';

describe('RenderInterceptor — segment request hardening', () => {
  let mockReflector: Reflector;
  let mockRenderService: {
    render: ReturnType<typeof vi.fn>;
    renderSegment: ReturnType<typeof vi.fn>;
    getRootLayout: ReturnType<typeof vi.fn>;
  };
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  const TestComponent = () => null;
  TestComponent.displayName = 'TestComponent';

  const RootLayout = () => null;
  RootLayout.displayName = 'RootLayout';

  beforeEach(() => {
    mockReflector = {
      get: vi.fn(),
    } as unknown as Reflector;

    mockRenderService = {
      render: vi.fn().mockResolvedValue('<html>Full Page</html>'),
      renderSegment: vi.fn().mockResolvedValue({
        html: '<div>Segment</div>',
        swapTarget: 'RootLayout',
      }),
      getRootLayout: vi.fn().mockResolvedValue(RootLayout),
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
      handle: vi.fn().mockReturnValue(of({ message: 'hello' })),
    } as unknown as CallHandler;

    vi.mocked(mockReflector.get).mockImplementation((key: unknown) => {
      if (key === RENDER_KEY) return TestComponent;
      if (key === RENDER_OPTIONS_KEY) return undefined;
      if (key === LAYOUT_KEY) return undefined;
      return undefined;
    });
  });

  function createInterceptor(clientNavigation?: boolean) {
    return new RenderInterceptor(
      mockReflector,
      mockRenderService as unknown as RenderService,
      undefined, // allowedHeaders
      undefined, // allowedCookies
      undefined, // contextFactory
      undefined, // jsonApiEnabled
      clientNavigation,
    );
  }

  it('should serve a segment for a valid X-Current-Layouts header', async () => {
    const interceptor = createInterceptor();
    mockRequest.headers = { 'x-current-layouts': 'RootLayout' };

    const result = await firstValueFrom(
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    );

    expect(mockRenderService.renderSegment).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ swapTarget: 'RootLayout' }),
    );
  });

  it('should fall back to full render when header has invalid characters', async () => {
    const interceptor = createInterceptor();
    mockRequest.headers = {
      'x-current-layouts': '<script>alert(1)</script>',
    };

    const result = await firstValueFrom(
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    );

    expect(mockRenderService.renderSegment).not.toHaveBeenCalled();
    expect(result).toBe('<html>Full Page</html>');
  });

  it('should accept layout names with accented (non-ASCII) letters', async () => {
    const interceptor = createInterceptor();
    mockRequest.headers = { 'x-current-layouts': 'ÉtéLayout' };

    const result = await firstValueFrom(
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    );

    // Valid name shape: treated as a segment request. The name matches no
    // layout in the chain, so the server signals a full client navigation
    // instead of silently discarding the header.
    expect(mockRenderService.render).not.toHaveBeenCalled();
    expect(result).toEqual({ swapTarget: null });
  });

  it('should fall back to full render when a name contains invisible characters', async () => {
    const interceptor = createInterceptor();
    // Zero-width space embedded in an otherwise plausible name
    mockRequest.headers = { 'x-current-layouts': 'Root\u200BLayout' };

    const result = await firstValueFrom(
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    );

    expect(mockRenderService.renderSegment).not.toHaveBeenCalled();
    expect(result).toBe('<html>Full Page</html>');
  });

  it('should fall back to full render when header has too many layout names', async () => {
    const interceptor = createInterceptor();
    mockRequest.headers = {
      'x-current-layouts': Array.from({ length: 21 }, (_, i) => `L${i}`).join(
        ',',
      ),
    };

    const result = await firstValueFrom(
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    );

    expect(mockRenderService.renderSegment).not.toHaveBeenCalled();
    expect(result).toBe('<html>Full Page</html>');
  });

  it('should fall back to full render when header contains an overly long name', async () => {
    const interceptor = createInterceptor();
    mockRequest.headers = { 'x-current-layouts': 'A'.repeat(129) };

    const result = await firstValueFrom(
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    );

    expect(mockRenderService.renderSegment).not.toHaveBeenCalled();
    expect(result).toBe('<html>Full Page</html>');
  });

  it('should ignore the segment header entirely when clientNavigation is disabled', async () => {
    const interceptor = createInterceptor(false);
    mockRequest.headers = { 'x-current-layouts': 'RootLayout' };

    const result = await firstValueFrom(
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    );

    expect(mockRenderService.renderSegment).not.toHaveBeenCalled();
    expect(result).toBe('<html>Full Page</html>');
  });

  it('should keep serving segments when clientNavigation is explicitly enabled', async () => {
    const interceptor = createInterceptor(true);
    mockRequest.headers = { 'x-current-layouts': 'RootLayout' };

    await firstValueFrom(
      interceptor.intercept(mockExecutionContext, mockCallHandler),
    );

    expect(mockRenderService.renderSegment).toHaveBeenCalled();
  });
});
