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
import { getErrorMessage } from './error.util';
import type { Socket } from 'node:net';
import { RenderService } from './render.service';
import type { ViteConfig } from '../interfaces';
import type { ViteDevServer } from 'vite';
import type { NestSsrProjectPaths } from '../config/nest-project-paths.interface';
import { SSR_PROJECT_PATHS } from '../config/nest-project-resolver';
import { detectAdapterType } from './adapters';
import { isDevelopmentEnv, warnIfNodeEnvUnset } from './environment.util';
import { loadDevTools } from './dev-tools';

/**
 * Upper bound on waiting for vite.close(). Nest runs onModuleDestroy before
 * dispose() closes the HTTP listener, so a vite close that never settles
 * would otherwise keep the dying process holding the port forever and every
 * subsequent hot-reload child would crash with EADDRINUSE.
 */
const VITE_CLOSE_TIMEOUT_MS = 3000;

/**
 * Automatically initializes Vite in development or static assets in production
 *
 * In development:
 * - Creates a Vite server in middleware mode for SSR module loading
 * - Sets up a proxy that forwards module requests (/src/, /@, /node_modules/)
 *   and Vite's HMR WebSocket to the external Vite dev server
 *
 * In production:
 * - Serves static assets from dist/client
 */
@Injectable()
export class ViteInitializerService
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  private readonly logger = new Logger(ViteInitializerService.name);
  private viteServer: ViteDevServer | null = null;
  private pendingViteServer: Promise<ViteDevServer | null> | null = null;
  private shutdownPromise: Promise<void> | null = null;
  private isShuttingDown = false;
  private readonly closedViteServers = new WeakSet<ViteDevServer>();
  private readonly trackedSockets = new Set<Socket>();
  private handlerInstalled = false;

  /**
   * What the request handler delegates to: the production static files or
   * the development Vite proxy, once set up. Until then requests pass on.
   */
  private requestHandler:
    ((req: unknown, res: unknown, next: () => void) => unknown) | undefined;

  /**
   * Put the static-file / Vite-proxy handler in front of the application's
   * routes. Called from `RenderModule.configure()`, which Nest runs after
   * the HTTP adapter is initialized and before any route is registered.
   * `onModuleInit` runs after the routes, so anything installed there came
   * after them, and a catch-all route (a 404 page, an SPA fallback) answered
   * for every built asset and every Vite module request.
   */
  installRequestHandler(): void {
    const httpAdapter = this.httpAdapterHost?.httpAdapter;
    if (this.handlerInstalled || typeof httpAdapter?.use !== 'function') {
      return;
    }
    this.handlerInstalled = true;
    httpAdapter.use((req: unknown, res: unknown, next: () => void) =>
      this.requestHandler ? this.requestHandler(req, res, next) : next(),
    );
  }

  constructor(
    private readonly renderService: RenderService,
    private readonly httpAdapterHost: HttpAdapterHost,
    @Inject(SSR_PROJECT_PATHS)
    private readonly projectPaths: NestSsrProjectPaths,
    @Optional()
    @Inject('VITE_CONFIG')
    private readonly viteConfig?: ViteConfig,
  ) {}

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

    // cleanup() re-raises the signal from its finally block, so a rejection
    // here only needs logging. Left unhandled it would surface as an
    // unhandled-rejection crash racing that re-raised signal.
    const handleSignal = (signal: NodeJS.Signals): Promise<void> =>
      cleanup(signal).catch((error: unknown) => {
        this.logger.error(
          `Error closing Vite server on ${signal}: ${getErrorMessage(error)}`,
        );
      });

    // The returned promise is deliberately handed back to the listener rather
    // than discarded: the .catch above means it can never reject, and the
    // shutdown contract test awaits it to observe the re-raised signal.
    /* eslint-disable @typescript-eslint/no-misused-promises */
    process.once('SIGTERM', () => handleSignal('SIGTERM'));
    process.once('SIGINT', () => handleSignal('SIGINT'));
    /* eslint-enable @typescript-eslint/no-misused-promises */
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
      // Development tooling is a separate chunk that production never loads.
      const dev = await loadDevTools();
      const creating = dev.createDevViteServer(this.projectPaths);
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
      await this.setupViteProxy(dev);

      this.logger.log('✓ Vite initialized for SSR');
    } catch (error) {
      this.logger.warn(
        `Failed to initialize Vite: ${getErrorMessage(error)}. Make sure vite is installed.`,
      );
    }
  }

  private async setupViteProxy(dev: Awaited<ReturnType<typeof loadDevTools>>) {
    try {
      const httpAdapter = this.httpAdapterHost.httpAdapter;
      if (!httpAdapter) {
        this.logger.warn(
          'HTTP adapter not available, skipping Vite proxy setup',
        );
        return;
      }

      const vitePort = this.viteConfig?.port || 5173;
      const { handler, access } = await dev.installViteProxy(httpAdapter, {
        vitePort,
        allowedHosts: this.viteConfig?.allowedHosts,
        allowedOrigins: this.viteConfig?.allowedOrigins,
        trackSocket: (socket: Socket) => {
          this.trackedSockets.add(socket);
          socket.once('close', () => this.trackedSockets.delete(socket));
        },
      });
      this.useRequestHandler(httpAdapter, handler);
      this.logger.log(
        `✓ Vite HMR proxy configured (Vite dev server on port ${vitePort}, ${access})`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to setup Vite proxy: ${getErrorMessage(error)}. Make sure http-proxy-middleware is installed.`,
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
        // Let Nest's installed platform adapter own static serving. Requiring
        // Express here made the bundler silently vendor an undeclared copy of
        // Express and its transitive dependency tree into this library.
        if (typeof httpAdapter.useStaticAssets !== 'function') {
          this.logger.warn(
            'Express adapter does not expose useStaticAssets; static assets were not configured',
          );
          return;
        }
        const options = { index: false, maxAge: '1y' };
        // The adapter builds the handler with its own express.static; it is
        // captured rather than appended, so it can run ahead of the routes.
        let handler: typeof this.requestHandler;
        httpAdapter.useStaticAssets.call(
          {
            use: (built: typeof this.requestHandler) => {
              handler = built;
            },
          },
          staticPath,
          options,
        );
        if (handler) {
          this.useRequestHandler(httpAdapter, handler);
        } else {
          httpAdapter.useStaticAssets(staticPath, options);
        }
        this.logger.log('✓ Static assets configured (dist/client) [Express]');
      }
    } catch (error) {
      this.logger.warn(
        `Failed to setup static assets: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Serve through the handler installed ahead of the routes; without it
   * (RenderModule.configure never ran), append it as before.
   */
  private useRequestHandler(
    httpAdapter: { use(handler: unknown): unknown },
    handler: NonNullable<typeof this.requestHandler>,
  ): void {
    this.requestHandler = handler;
    if (!this.handlerInstalled) httpAdapter.use(handler);
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

    // In production, requests in flight are left to finish: Nest's adapter
    // drains them (or force-closes, per `forceCloseConnections`) when it
    // closes the server. Cutting them here dropped responses in every
    // graceful shutdown, such as a rolling deploy.
    if (!isDevelopmentEnv()) return;

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
    } catch (error) {
      this.logger.warn(
        `Failed to close Vite server: ${getErrorMessage(error)}`,
      );
    }
  }
}
