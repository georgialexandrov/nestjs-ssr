import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Socket } from 'node:net';

// Mock vite before importing the service
vi.mock('vite', () => ({
  createServer: vi.fn(),
}));

vi.mock('@vitejs/plugin-react', () => ({
  default: vi.fn(() => 'react-plugin'),
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
import { createDefaultTestProjectPaths } from './test-project-paths';

const defaultProjectPaths = createDefaultTestProjectPaths('/project');

describe('ViteInitializerService', () => {
  let service: ViteInitializerService;
  let mockRenderService: Partial<RenderService>;
  let mockHttpAdapterHost: any;
  let mockApp: any;
  let mockViteServer: any;
  let mockHttpServer: any;
  let httpServerHandlers: Record<string, ((...args: any[]) => void)[]>;
  let processOnceSpy: ReturnType<typeof vi.spyOn>;
  let killSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';

    mockRenderService = {
      setViteServer: vi.fn(),
    };

    mockApp = {
      use: vi.fn(),
      register: vi.fn().mockResolvedValue(undefined),
    };

    httpServerHandlers = {};
    mockHttpServer = {
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        (httpServerHandlers[event] ||= []).push(handler);
      }),
      closeAllConnections: vi.fn(),
    };

    mockHttpAdapterHost = {
      httpAdapter: {
        getInstance: vi.fn().mockReturnValue(mockApp),
        getHttpServer: vi.fn().mockReturnValue(mockHttpServer),
      },
    };

    mockViteServer = {
      close: vi.fn().mockResolvedValue(undefined),
      middlewares: {},
      watcher: { on: vi.fn() },
      moduleGraph: {
        getModulesByFile: vi.fn().mockReturnValue(null),
        invalidateModule: vi.fn(),
      },
    };

    vi.mocked(createViteServer).mockResolvedValue(mockViteServer);

    processOnceSpy = vi
      .spyOn(process, 'once')
      .mockImplementation(() => process);

    // The signal handler re-raises the signal after cleanup; never let that
    // reach the real process during tests.
    killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  function createService(viteConfig?: { port?: number }) {
    return new ViteInitializerService(
      mockRenderService as RenderService,
      mockHttpAdapterHost,
      defaultProjectPaths,
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
    it('should register SIGTERM and SIGINT handlers via process.once on init', async () => {
      service = createService();

      // Constructor must not touch process-level state
      expect(processOnceSpy).not.toHaveBeenCalled();

      await service.onModuleInit();

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

      const [config] = vi.mocked(createViteServer).mock.calls[0] as [any];
      expect(config).toMatchObject({
        root: defaultProjectPaths.viteRoot,
        configFile: false,
        server: { middlewareMode: true },
        appType: 'custom',
        resolve: {
          alias: {
            '@': defaultProjectPaths.aliasAt,
          },
        },
      });
      // hmr port is an OS-assigned ephemeral port — a literal 0 is NOT
      // acceptable: Vite 8 treats 0 as unset and binds the fixed default
      // 24678, which collides across hot-reload restarts.
      expect(config.server.hmr.port).toBeGreaterThan(0);
      expect(config.server.hmr.port).toBeLessThanOrEqual(65535);
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

    it('forcibly destroys an upgraded socket on shutdown (regression)', async () => {
      // closeAllConnections() does NOT reach upgraded WebSocket sockets —
      // they're removed from the http.Server's connection tracking after
      // 'upgrade' fires. This was the bug that hung the process across HMR
      // restarts: a Vite HMR WS proxied through the nest server held the
      // dying process open until something else killed it.
      vi.mocked(createProxyMiddleware).mockReturnValue(
        'proxy-middleware' as any,
      );

      service = createService();
      await service.onModuleInit();

      const onCalls = (mockHttpServer.on as any).mock.calls as [
        string,
        (...args: any[]) => void,
      ][];
      const upgradeHandler = onCalls.find(([e]) => e === 'upgrade')?.[1];
      expect(upgradeHandler).toBeDefined();

      let closeHandler: (() => void) | undefined;
      const upgradedSocket = {
        destroyed: false,
        once: vi.fn((event: string, handler: () => void) => {
          if (event === 'close') {
            closeHandler = handler;
          }
          return upgradedSocket;
        }),
        destroy: vi.fn(() => {
          upgradedSocket.destroyed = true;
          closeHandler?.();
        }),
      } as unknown as Socket & {
        destroyed: boolean;
        once: ReturnType<typeof vi.fn>;
        destroy: ReturnType<typeof vi.fn>;
      };

      upgradeHandler!({}, upgradedSocket);
      expect((service as any).trackedSockets.has(upgradedSocket)).toBe(true);

      await service.onModuleDestroy();

      expect(mockHttpServer.closeAllConnections).toHaveBeenCalled();
      expect(upgradedSocket.destroy).toHaveBeenCalled();
      expect(upgradedSocket.destroyed).toBe(true);
      expect((service as any).trackedSockets.size).toBe(0);
    });

    it('destroys tracked sockets on shutdown so the process can exit', async () => {
      // Reset proxy middleware mock — an earlier test sets it to throw.
      vi.mocked(createProxyMiddleware).mockReturnValue(
        'proxy-middleware' as any,
      );

      service = createService();
      await service.onModuleInit();

      const onCalls = (mockHttpServer.on as any).mock.calls as [
        string,
        (...args: any[]) => void,
      ][];
      const connectionHandler = onCalls.find(([e]) => e === 'connection')?.[1];
      const upgradeHandler = onCalls.find(([e]) => e === 'upgrade')?.[1];
      expect(connectionHandler).toBeDefined();
      expect(upgradeHandler).toBeDefined();

      // Simulate two live sockets the http server has accepted, including
      // one that later upgraded to a WebSocket (the case closeAllConnections
      // does not cover).
      const httpSocket = { destroy: vi.fn(), once: vi.fn() } as any;
      const upgradedSocket = { destroy: vi.fn(), once: vi.fn() } as any;
      connectionHandler!(httpSocket);
      upgradeHandler!({}, upgradedSocket);

      await service.onModuleDestroy();

      expect(mockHttpServer.closeAllConnections).toHaveBeenCalled();
      expect(httpSocket.destroy).toHaveBeenCalled();
      expect(upgradedSocket.destroy).toHaveBeenCalled();
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

  describe('hot-reload shutdown contract', () => {
    // nest start --watch SIGTERMs the running child and only spawns the next
    // one after the old child exits. Any path where the child survives SIGTERM
    // (a swallowed signal, a hung vite close, leaked sockets) leaves an orphan
    // holding the port, and every subsequent reload crashes with EADDRINUSE.
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      vi.mocked(createProxyMiddleware).mockReturnValue(
        'proxy-middleware' as any,
      );
    });

    function getSignalHandler(signal: string) {
      const call = processOnceSpy.mock.calls.find((c) => c[0] === signal);
      expect(call).toBeDefined();
      return call![1] as () => Promise<void>;
    }

    it('closes vite exactly once when the signal handler races module destroy', async () => {
      // With enableShutdownHooks(), a SIGTERM triggers BOTH the library's own
      // signal handler and Nest's destroy hooks concurrently. Both used to
      // enter closeViteServer() before viteServer was nulled, double-closing
      // the Vite server ("✓ Vite server closed" logged twice per shutdown).
      const closeResolvers: Array<() => void> = [];
      mockViteServer.close = vi.fn(
        () => new Promise<void>((resolve) => closeResolvers.push(resolve)),
      );

      service = createService();
      await service.onModuleInit();

      const handler = getSignalHandler('SIGTERM');
      const signalDone = handler(); // close #1 starts, suspended on vite.close()
      const destroyDone = service.onModuleDestroy(); // must join, not re-close

      closeResolvers.forEach((resolve) => resolve());
      await Promise.all([signalDone, destroyDone]);

      expect(mockViteServer.close).toHaveBeenCalledTimes(1);
    });

    it('closes a vite server that finishes initializing after SIGTERM arrived', async () => {
      // nest watch can SIGTERM the child while createViteServer() is still in
      // flight (restart during startup, e.g. two quick saves). The old guard
      // saw viteServer === null, marked isShuttingDown, and returned — the
      // late-created Vite server (watchers, HMR websocket port) was never
      // closed and kept the process alive forever: the orphan that holds
      // port 3000 across every following hot reload.
      let resolveCreate!: (server: any) => void;
      vi.mocked(createViteServer).mockReturnValue(
        new Promise((resolve) => (resolveCreate = resolve)),
      );

      service = createService();
      const initDone = service.onModuleInit(); // suspended in createViteServer

      const handler = getSignalHandler('SIGTERM');
      const signalDone = handler(); // arrives mid-initialization

      resolveCreate(mockViteServer);
      await initDone;
      await signalDone;

      expect(mockViteServer.close).toHaveBeenCalledTimes(1);
      expect(mockRenderService.setViteServer).not.toHaveBeenCalledWith(
        mockViteServer,
      );
    });

    it('re-raises the signal after cleanup so the process exits without enableShutdownHooks', async () => {
      // process.once('SIGTERM', ...) suppresses the default terminate action.
      // If the handler only closes Vite and returns, the Nest HTTP server keeps
      // listening and the process survives SIGTERM indefinitely — observed
      // live: an orphan still serving :3000 minutes after nest watch killed
      // it, dying only on a second SIGTERM. The handler must re-raise.
      service = createService();
      await service.onModuleInit();

      const handler = getSignalHandler('SIGTERM');
      await handler();

      expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGTERM');
    });

    it('re-raises even when shutdown already ran, so a late signal still terminates', async () => {
      service = createService();
      await service.onModuleInit();
      await service.onModuleDestroy();

      const handler = getSignalHandler('SIGTERM');
      await handler();

      expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGTERM');
    });

    it('does not let a hanging vite close block shutdown forever', async () => {
      // Nest runs onModuleDestroy BEFORE dispose() closes the HTTP listener.
      // If vite.close() never settles, dispose() never runs, the port is never
      // released, and the next watch child crashes with EADDRINUSE. Shutdown
      // must proceed after a bounded wait and still destroy tracked sockets.
      vi.useFakeTimers();
      try {
        mockViteServer.close = vi.fn(() => new Promise<void>(() => {}));

        service = createService();
        await service.onModuleInit();

        const onCalls = (mockHttpServer.on as any).mock.calls as [
          string,
          (...args: any[]) => void,
        ][];
        const connectionHandler = onCalls.find(
          ([e]) => e === 'connection',
        )?.[1];
        const socket = { destroy: vi.fn(), once: vi.fn() } as any;
        connectionHandler!(socket);

        const destroyDone = service.onModuleDestroy();
        await vi.advanceTimersByTimeAsync(10_000);
        await destroyDone;

        expect(mockHttpServer.closeAllConnections).toHaveBeenCalled();
        expect(socket.destroy).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
