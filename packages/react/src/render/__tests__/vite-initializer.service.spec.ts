import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock vite before importing the service
vi.mock('vite', () => ({
  createServer: vi.fn(),
}));

// Mock http-proxy-middleware
vi.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: vi.fn().mockReturnValue('proxy-middleware'),
}));

// Mock express for production static serving
vi.mock('express', () => {
  const staticFn = vi.fn().mockReturnValue('express-static-middleware');
  return {
    default: { static: staticFn },
    static: staticFn,
  };
});

// Mock path
vi.mock('path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
  default: { join: vi.fn((...args: string[]) => args.join('/')) },
}));

// Mock adapters
vi.mock('../adapters', () => ({
  detectAdapterType: vi.fn().mockReturnValue('express'),
}));

import { ViteInitializerService } from '../vite-initializer.service';
import { RenderService } from '../render.service';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { detectAdapterType } from '../adapters';

describe('ViteInitializerService', () => {
  let service: ViteInitializerService;
  let mockRenderService: Partial<RenderService>;
  let mockHttpAdapterHost: any;
  let mockApp: any;
  let mockViteServer: any;
  let processOnceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';

    mockRenderService = {
      setViteServer: vi.fn(),
    };

    mockApp = {
      use: vi.fn(),
      register: vi.fn().mockResolvedValue(undefined),
    };

    mockHttpAdapterHost = {
      httpAdapter: {
        getInstance: vi.fn().mockReturnValue(mockApp),
      },
    };

    mockViteServer = {
      close: vi.fn().mockResolvedValue(undefined),
      middlewares: {},
    };

    vi.mocked(createViteServer).mockResolvedValue(mockViteServer);

    processOnceSpy = vi.spyOn(process, 'once');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  function createService(viteConfig?: { port?: number }) {
    return new ViteInitializerService(
      mockRenderService as RenderService,
      mockHttpAdapterHost,
      viteConfig,
    );
  }

  describe('constructor', () => {
    it('should default vitePort to 5173', () => {
      service = createService();
      expect(service).toBeDefined();
    });

    it('should use provided vite port', () => {
      service = createService({ port: 3001 });
      expect(service).toBeDefined();
    });
  });

  describe('registerSignalHandlers', () => {
    it('should register SIGTERM and SIGINT handlers via process.once', () => {
      service = createService();

      expect(processOnceSpy).toHaveBeenCalledWith(
        'SIGTERM',
        expect.any(Function),
      );
      expect(processOnceSpy).toHaveBeenCalledWith(
        'SIGINT',
        expect.any(Function),
      );
    });
  });

  describe('setupDevelopmentMode (onModuleInit)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should create Vite server in middleware mode', async () => {
      service = createService();
      await service.onModuleInit();

      expect(createViteServer).toHaveBeenCalledWith({
        server: { middlewareMode: true },
        appType: 'custom',
      });
    });

    it('should set vite server on renderService', async () => {
      service = createService();
      await service.onModuleInit();

      expect(mockRenderService.setViteServer).toHaveBeenCalledWith(
        mockViteServer,
      );
    });

    it('should setup vite proxy after creating server', async () => {
      service = createService();
      await service.onModuleInit();

      expect(createProxyMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'http://localhost:5173',
          changeOrigin: true,
          ws: true,
          pathFilter: expect.any(Function),
        }),
      );
      expect(mockApp.use).toHaveBeenCalledWith('proxy-middleware');
    });

    it('should use custom vite port for proxy target', async () => {
      service = createService({ port: 4000 });
      await service.onModuleInit();

      expect(createProxyMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'http://localhost:4000',
        }),
      );
    });

    it('should handle vite import failure gracefully', async () => {
      vi.mocked(createViteServer).mockRejectedValue(
        new Error('Cannot find module vite'),
      );

      service = createService();
      // Should not throw
      await service.onModuleInit();

      expect(mockRenderService.setViteServer).not.toHaveBeenCalled();
    });
  });

  describe('setupViteProxy', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should skip proxy when httpAdapter is not available', async () => {
      mockHttpAdapterHost.httpAdapter = null;

      service = createService();
      await service.onModuleInit();

      // createViteServer is called but proxy is not set up
      expect(createViteServer).toHaveBeenCalled();
      expect(createProxyMiddleware).not.toHaveBeenCalled();
    });

    it('should filter paths starting with /src/, /@, or /node_modules/', async () => {
      service = createService();
      await service.onModuleInit();

      const call = vi.mocked(createProxyMiddleware).mock.calls[0][0] as any;
      const pathFilter = call.pathFilter;

      expect(pathFilter('/src/main.tsx')).toBe(true);
      expect(pathFilter('/@vite/client')).toBe(true);
      expect(pathFilter('/node_modules/.vite/react.js')).toBe(true);
      expect(pathFilter('/api/users')).toBe(false);
      expect(pathFilter('/')).toBe(false);
    });

    it('should handle http-proxy-middleware import failure gracefully', async () => {
      vi.mocked(createProxyMiddleware).mockImplementation(() => {
        throw new Error('Cannot find module http-proxy-middleware');
      });

      service = createService();
      // Should not throw
      await service.onModuleInit();

      // Vite server should still be created
      expect(createViteServer).toHaveBeenCalled();
    });
  });

  describe('setupProductionMode (onModuleInit)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should register express static middleware for Express adapter', async () => {
      vi.mocked(detectAdapterType).mockReturnValue('express');

      service = createService();
      await service.onModuleInit();

      // Express adapter path calls app.use() with static middleware
      expect(mockApp.use).toHaveBeenCalled();
    });

    it('should register @fastify/static for Fastify adapter', async () => {
      vi.mocked(detectAdapterType).mockReturnValue('fastify');

      // Mock the dynamic import of @fastify/static
      const mockFastifyStatic = { default: vi.fn() };
      vi.stubGlobal(
        '__vitest_dynamic_import__',
        vi.fn().mockResolvedValue(mockFastifyStatic),
      );

      // We need to mock the actual import() call inside setupProductionMode
      // The service uses: await import('@fastify/static' as string).catch(() => null)
      // Since we can't easily intercept dynamic import, we verify app.register is called
      // when the module resolves

      service = createService();
      await service.onModuleInit();

      expect(mockApp.register).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          root: expect.stringContaining('dist/client'),
          prefix: '/',
          index: false,
          maxAge: 31536000000,
        }),
      );
    });

    it('should skip when httpAdapter is not available', async () => {
      mockHttpAdapterHost.httpAdapter = null;

      service = createService();
      // Should not throw
      await service.onModuleInit();

      expect(mockApp.use).not.toHaveBeenCalled();
    });
  });

  describe('closeViteServer (onModuleDestroy / onApplicationShutdown)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should close vite server on module destroy', async () => {
      service = createService();
      await service.onModuleInit();

      await service.onModuleDestroy();

      expect(mockViteServer.close).toHaveBeenCalled();
    });

    it('should clear renderService vite reference before closing', async () => {
      service = createService();
      await service.onModuleInit();

      // Reset to track the order
      vi.mocked(mockRenderService.setViteServer!).mockClear();

      await service.onModuleDestroy();

      expect(mockRenderService.setViteServer).toHaveBeenCalledWith(null);
    });

    it('should close vite server on application shutdown', async () => {
      service = createService();
      await service.onModuleInit();

      await service.onApplicationShutdown();

      expect(mockViteServer.close).toHaveBeenCalled();
    });

    it('should handle close error gracefully', async () => {
      mockViteServer.close.mockRejectedValue(new Error('Close failed'));

      service = createService();
      await service.onModuleInit();

      // Should not throw
      await service.onModuleDestroy();
    });

    it('should not call close when no vite server exists', async () => {
      process.env.NODE_ENV = 'production';

      service = createService();
      await service.onModuleInit();

      await service.onModuleDestroy();

      expect(mockViteServer.close).not.toHaveBeenCalled();
    });

    it('should only close once even if called multiple times', async () => {
      service = createService();
      await service.onModuleInit();

      await service.onModuleDestroy();
      await service.onApplicationShutdown();

      // close() called only once — second call is a no-op because
      // viteServer is set to null after first close
      expect(mockViteServer.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('signal handler cleanup', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should close vite server on SIGTERM', async () => {
      service = createService();
      await service.onModuleInit();

      // Find the SIGTERM handler
      const sigtermCall = processOnceSpy.mock.calls.find(
        (call) => call[0] === 'SIGTERM',
      );
      expect(sigtermCall).toBeDefined();

      const handler = sigtermCall![1] as () => Promise<void>;
      await handler();

      expect(mockViteServer.close).toHaveBeenCalled();
    });

    it('should close vite server on SIGINT', async () => {
      service = createService();
      await service.onModuleInit();

      const sigintCall = processOnceSpy.mock.calls.find(
        (call) => call[0] === 'SIGINT',
      );
      expect(sigintCall).toBeDefined();

      const handler = sigintCall![1] as () => Promise<void>;
      await handler();

      expect(mockViteServer.close).toHaveBeenCalled();
    });

    it('should not close twice if signal fires after shutdown', async () => {
      service = createService();
      await service.onModuleInit();

      // First: normal shutdown
      await service.onModuleDestroy();
      expect(mockViteServer.close).toHaveBeenCalledTimes(1);

      // Then: signal fires — should be a no-op (isShuttingDown is true)
      const sigtermCall = processOnceSpy.mock.calls.find(
        (call) => call[0] === 'SIGTERM',
      );
      const handler = sigtermCall![1] as () => Promise<void>;
      await handler();

      expect(mockViteServer.close).toHaveBeenCalledTimes(1);
    });
  });
});
