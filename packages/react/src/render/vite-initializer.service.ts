import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  OnApplicationShutdown,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { createServer as createNetServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
import { RenderService } from './render.service';
import type { ViteConfig } from '../interfaces';
import type { ViteDevServer } from 'vite';
import type { NestSsrProjectPaths } from '../config/nest-project-paths.interface';
import { SSR_PROJECT_PATHS } from '../config/nest-project-resolver';
import { detectAdapterType } from './adapters';
import { isDevelopmentEnv, warnIfNodeEnvUnset } from './environment.util';

/**
 * Upper bound on waiting for vite.close(). Nest runs onModuleDestroy before
 * dispose() closes the HTTP listener, so a vite close that never settles
 * would otherwise keep the dying process holding the port forever and every
 * subsequent hot-reload child would crash with EADDRINUSE.
 */
const VITE_CLOSE_TIMEOUT_MS = 3000;

/**
 * Reserve an OS-assigned free port for the embedded Vite server's HMR
 * WebSocket. Vite 7 honored hmr:{port:0} as "pick a random port", but Vite 8
 * treats 0 as unset and binds the default HMR port (24678) — which collides
 * across hot-reload restarts and with other Vite instances on the machine.
 */
async function getEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Automatically initializes Vite in development or static assets in production
 *
 * In development:
 * - Creates a Vite server in middleware mode for SSR module loading
 * - Sets up a proxy to forward HMR requests to external Vite dev server
 *
 * In production:
 * - Serves static assets from dist/client
 */
@Injectable()
export class ViteInitializerService
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  private readonly logger = new Logger(ViteInitializerService.name);
  private readonly vitePort: number;
  private viteServer: ViteDevServer | null = null;
  private pendingViteServer: Promise<ViteDevServer | null> | null = null;
  private shutdownPromise: Promise<void> | null = null;
  private isShuttingDown = false;
  private readonly closedViteServers = new WeakSet<ViteDevServer>();
  private readonly trackedSockets = new Set<Socket>();

  constructor(
    private readonly renderService: RenderService,
    private readonly httpAdapterHost: HttpAdapterHost,
    @Inject(SSR_PROJECT_PATHS)
    private readonly projectPaths: NestSsrProjectPaths,
    @Optional() @Inject('VITE_CONFIG') viteConfig?: ViteConfig,
  ) {
    this.vitePort = viteConfig?.port || 5173;
  }

  private registerSignalHandlers() {
    const cleanup = async (signal: NodeJS.Signals) => {
      if (!this.isShuttingDown) {
        this.logger.log(`Received ${signal}, closing Vite server...`);
      }
      try {
        await this.closeViteServer();
      } finally {
        // Re-raise the signal: process.once() suppressed the default
        // terminate action, and without enableShutdownHooks() nothing else
        // would stop the Nest HTTP server — the process would survive
        // SIGTERM with the port still bound, orphaning every subsequent
        // `nest start --watch` restart with EADDRINUSE. When shutdown hooks
        // ARE enabled, Nest's own signal listener ignores this duplicate
        // and re-raises again after its graceful cleanup completes.
        process.kill(process.pid, signal);
      }
    };

    process.once('SIGTERM', () => cleanup('SIGTERM'));
    process.once('SIGINT', () => cleanup('SIGINT'));
  }

  async onModuleInit() {
    // Register signal handlers for cleanup when lifecycle hooks may not fire
    // This handles cases where enableShutdownHooks() wasn't called.
    // Registered here rather than in the constructor so plain instantiation
    // (tests, DI graph construction) has no process-level side effects.
    this.registerSignalHandlers();

    warnIfNodeEnvUnset(this.logger);

    if (isDevelopmentEnv()) {
      await this.setupDevelopmentMode();
    } else {
      await this.setupProductionMode();
    }
  }

  private async setupDevelopmentMode() {
    try {
      // Dynamically import Vite (ESM)
      const { createServer: createViteServer } = await import('vite');
      const react = (await import('@vitejs/plugin-react')).default;

      // An OS-assigned free port for the HMR WebSocket avoids conflicts with
      // the external Vite dev server ("Port 5173 is already in use") and
      // with previous hot-reload children. No browser connects to this
      // WebSocket (client HMR goes through the external dev server via the
      // proxy), so the random port is harmless. hmr:{port:0} is not used
      // because Vite 8 treats 0 as unset and binds the fixed default 24678.
      const hmrPort = await getEphemeralPort();
      const creating = createViteServer({
        root: this.projectPaths.viteRoot,
        configFile: false,
        plugins: [react({})],
        resolve: {
          alias: {
            '@': this.projectPaths.aliasAt,
          },
          dedupe: ['react', 'react-dom', '@nestjs-ssr/react'],
        },
        ssr: {
          noExternal: ['@nestjs-ssr/react'],
        },
        server: { middlewareMode: true, hmr: { port: hmrPort } },
        appType: 'custom',
      });
      this.pendingViteServer = creating.catch(() => null);
      const viteServer = await creating;

      if (this.isShuttingDown) {
        // A shutdown signal arrived while createViteServer() was in flight
        // (nest watch restarting during startup). Close the late-created
        // server instead of wiring it up, or it would keep the dying
        // process alive holding the port.
        if (viteServer) await this.closeViteInstance(viteServer);
        return;
      }

      this.viteServer = viteServer;
      this.renderService.setViteServer(this.viteServer);

      // Set up proxy to external Vite dev server for HMR
      await this.setupViteProxy();

      this.logger.log('✓ Vite initialized for SSR');
    } catch (error: any) {
      this.logger.warn(
        `Failed to initialize Vite: ${error.message}. Make sure vite is installed.`,
      );
    }
  }

  private async setupViteProxy() {
    try {
      const httpAdapter = this.httpAdapterHost.httpAdapter;
      if (!httpAdapter) {
        this.logger.warn(
          'HTTP adapter not available, skipping Vite proxy setup',
        );
        return;
      }

      const app = httpAdapter.getInstance();

      // Dynamically import http-proxy-middleware
      const { createProxyMiddleware } = await import('http-proxy-middleware');

      const viteProxy = createProxyMiddleware({
        target: `http://localhost:${this.vitePort}`,
        changeOrigin: true,
        ws: true, // Enable WebSocket for HMR
        pathFilter: (pathname: string) => {
          return (
            pathname.startsWith('/src/') ||
            pathname.startsWith('/@') ||
            pathname.startsWith('/node_modules/')
          );
        },
      });

      app.use(viteProxy);
      this.logger.log(
        `✓ Vite HMR proxy configured (Vite dev server on port ${this.vitePort})`,
      );

      // Track every TCP socket the http server accepts so we can forcefully
      // destroy them on shutdown. http.Server#closeAllConnections() does not
      // reach upgraded WebSocket connections or sockets stuck mid-upgrade,
      // which is what keeps the old process alive across HMR restarts.
      const httpServer = httpAdapter.getHttpServer?.();
      if (httpServer && typeof httpServer.on === 'function') {
        const track = (socket: Socket) => {
          this.trackedSockets.add(socket);
          socket.once('close', () => this.trackedSockets.delete(socket));
        };
        httpServer.on('connection', track);
        httpServer.on('upgrade', (_req: unknown, socket: Socket) =>
          track(socket),
        );
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to setup Vite proxy: ${error.message}. Make sure http-proxy-middleware is installed.`,
      );
    }
  }

  private async setupProductionMode() {
    try {
      const httpAdapter = this.httpAdapterHost.httpAdapter;
      if (!httpAdapter) return;

      const app = httpAdapter.getInstance();
      const staticPath = this.projectPaths.clientDistDir;
      const adapterType = detectAdapterType(this.httpAdapterHost);

      if (adapterType === 'fastify') {
        // Fastify static file serving
        try {
          // Dynamic import with type suppression since @fastify/static is optional
          const fastifyStatic = await import('@fastify/static').catch(
            () => null,
          );
          if (fastifyStatic) {
            await app.register(fastifyStatic.default, {
              root: staticPath,
              prefix: '/',
              index: false,
              maxAge: 31536000000, // 1 year in ms
            });
            this.logger.log(
              '✓ Static assets configured (dist/client) [Fastify]',
            );
          } else {
            this.logger.warn(
              'For Fastify static file serving, install @fastify/static: npm install @fastify/static',
            );
          }
        } catch {
          this.logger.warn(
            'For Fastify static file serving, install @fastify/static: npm install @fastify/static',
          );
        }
      } else {
        // Express static file serving
        const express = require('express');
        app.use(
          express.static(staticPath, {
            index: false,
            maxAge: '1y',
          }),
        );
        this.logger.log('✓ Static assets configured (dist/client) [Express]');
      }
    } catch (error: any) {
      this.logger.warn(`Failed to setup static assets: ${error.message}`);
    }
  }

  /**
   * Cleanup: Close Vite server on module destroy
   * This prevents port conflicts on hot reload
   */
  async onModuleDestroy() {
    await this.closeViteServer();
  }

  /**
   * Cleanup: Close Vite server on application shutdown
   * Belt-and-suspenders approach with onModuleDestroy
   */
  async onApplicationShutdown() {
    await this.closeViteServer();
  }

  private closeViteServer(): Promise<void> {
    // Single-flight: the signal handler and Nest's destroy/shutdown hooks
    // race on SIGTERM (enableShutdownHooks runs onModuleDestroy while our
    // own handler is mid-cleanup). Every caller joins the same shutdown
    // instead of double-closing the Vite server.
    this.shutdownPromise ??= this.performShutdown();
    return this.shutdownPromise;
  }

  private async performShutdown(): Promise<void> {
    this.isShuttingDown = true;

    // A signal can land while createViteServer() is still in flight; wait
    // for it so the late-created server is closed rather than leaked.
    const viteServer =
      this.viteServer ??
      (await this.pendingViteServer?.catch(() => null)) ??
      this.viteServer;

    if (viteServer) {
      // Clear render service reference first
      this.renderService.setViteServer(null as any);
      await this.closeViteInstance(viteServer);
      this.viteServer = null;
    }

    // Force-close HTTP connections so the process exits cleanly on hot reload.
    // Browser keep-alive and proxied WebSocket connections would otherwise hold
    // the old process open until the browser's next request causes an error.
    // closeAllConnections() handles HTTP-tracked sockets; the trackedSockets
    // set covers upgraded/limbo sockets that closeAllConnections misses.
    const httpServer = this.httpAdapterHost?.httpAdapter?.getHttpServer?.();
    if (httpServer && typeof httpServer.closeAllConnections === 'function') {
      httpServer.closeAllConnections();
    }
    for (const socket of this.trackedSockets) {
      socket.destroy();
    }
    this.trackedSockets.clear();
  }

  private async closeViteInstance(viteServer: ViteDevServer): Promise<void> {
    if (this.closedViteServers.has(viteServer)) return;
    this.closedViteServers.add(viteServer);

    try {
      // Bound the wait: a vite.close() that never settles must not block
      // Nest's dispose(), which releases the port for the next watch child.
      const closed = await Promise.race([
        viteServer.close().then(() => true),
        new Promise<false>((resolve) => {
          const timer = setTimeout(() => resolve(false), VITE_CLOSE_TIMEOUT_MS);
          timer.unref?.();
        }),
      ]);
      if (closed) {
        this.logger.log('✓ Vite server closed');
      } else {
        this.logger.warn(
          `Vite server did not close within ${VITE_CLOSE_TIMEOUT_MS}ms, continuing shutdown`,
        );
      }
    } catch (error: any) {
      this.logger.warn(`Failed to close Vite server: ${error.message}`);
    }
  }
}
