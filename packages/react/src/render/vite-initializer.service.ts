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
import { createServer as createNetServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
import type { IncomingMessage } from 'node:http';
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
 * WebSocket subprotocols Vite's browser client uses. "vite-hmr" carries the
 * hot-update messages; "vite-ping" is the poll the client uses to detect the
 * dev server coming back after a restart. Matching on the subprotocol (rather
 * than on a path) is what lets the proxy recognise the HMR socket: Vite opens
 * it at the base path ("/"), which is indistinguishable from an application
 * route by URL alone.
 */
const VITE_WS_PROTOCOLS = new Set(['vite-hmr', 'vite-ping']);

/**
 * Whether a request is Vite's HMR/ping WebSocket handshake.
 *
 * Without this, the proxy's path filter rejects the handshake (its path is
 * "/") and http-proxy-middleware's upgrade handler returns without either
 * proxying or destroying the socket — the browser's HMR connection then hangs
 * open forever. Vite's client awaits `open` or `close` with no timeout, so a
 * hung socket also suppresses its built-in "direct websocket connection
 * fallback", leaving HMR silently dead.
 */
function isViteWebSocketUpgrade(req?: {
  headers?: Record<string, string | string[] | undefined>;
}): boolean {
  const headers = req?.headers;
  if (!headers) return false;

  const upgrade = headers['upgrade'];
  if (typeof upgrade !== 'string' || upgrade.toLowerCase() !== 'websocket') {
    return false;
  }

  const requested = headers['sec-websocket-protocol'];
  const protocols = Array.isArray(requested)
    ? requested
    : String(requested ?? '').split(',');

  return protocols.some((protocol) => VITE_WS_PROTOCOLS.has(protocol.trim()));
}

/**
 * Whether a peer address belongs to this machine.
 *
 * Deliberately reads the real socket peer and never X-Forwarded-For: the
 * point is to identify the developer's own browser, and a forwarded header is
 * attacker-controlled.
 *
 * An absent address means a UNIX domain socket, which is local by
 * construction.
 */
function isLoopbackAddress(address?: string | null): boolean {
  if (!address) return true;

  // IPv4-mapped IPv6 ("::ffff:127.0.0.1") — compare the embedded IPv4.
  const normalized = address.startsWith('::ffff:') ? address.slice(7) : address;

  return (
    normalized === '::1' ||
    normalized === 'localhost' ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)
  );
}

/**
 * Whether a request arrived from this machine.
 */
function normalizeHostname(value?: string): string | null {
  if (!value || /[@/\\\s,]/.test(value)) return null;
  try {
    const hostname = new URL(`http://${value}`).hostname.toLowerCase();
    return hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname.replace(/\.$/, '');
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    isLoopbackAddress(hostname)
  );
}

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isViteProxyRequestAllowed(
  req:
    | {
        headers?: Record<string, string | string[] | undefined>;
        socket?: { remoteAddress?: string };
      }
    | undefined,
  allowedHosts: ReadonlySet<string>,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  const headers = req?.headers ?? {};
  const hostname = normalizeHostname(firstHeader(headers.host));
  if (!hostname) return false;

  const explicitlyAllowedHost = allowedHosts.has(hostname);
  const hostAllowed = isLoopbackHostname(hostname) || explicitlyAllowedHost;
  const peerAllowed =
    isLoopbackAddress(req?.socket?.remoteAddress) || explicitlyAllowedHost;

  const forwarded =
    headers.forwarded !== undefined ||
    headers['x-forwarded-for'] !== undefined ||
    headers['x-forwarded-host'] !== undefined ||
    headers['x-forwarded-proto'] !== undefined;
  if (forwarded && !explicitlyAllowedHost) return false;

  const rawOrigin = firstHeader(headers.origin);
  const origin = rawOrigin ? normalizeOrigin(rawOrigin) : null;
  if (rawOrigin && !origin) return false;
  const originHostname = origin
    ? normalizeHostname(new URL(origin).host)
    : null;
  const originAllowed =
    !origin ||
    (isLoopbackHostname(hostname) &&
      !!originHostname &&
      isLoopbackHostname(originHostname)) ||
    allowedOrigins.has(origin);

  return hostAllowed && peerAllowed && originAllowed;
}

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
 * Where the HMR WebSocket port goes, which moved in Vite 8.2.
 *
 * Vite 8.2 deprecated `server.hmr.port` in favour of `server.ws.port` and warns
 * on every startup when the old key is used. Vite 6 and 7 are still supported
 * peers and do not read `server.ws` at all, so writing only the new key there
 * would silently drop the port — and an unset port sends the SSR server back to
 * the fixed default that collides with the external dev server and with every
 * previous hot-reload child.
 */
function websocketPortOption(
  port: number,
  viteVersion?: string,
): { ws: { port: number } } | { hmr: { port: number } } {
  const major = Number.parseInt(viteVersion ?? '', 10);
  const minor = Number.parseInt(viteVersion?.split('.')[1] ?? '', 10);
  const supportsWs = major > 8 || (major === 8 && minor >= 2);
  return supportsWs ? { ws: { port } } : { hmr: { port } };
}

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
  private readonly vitePort: number;
  private readonly allowedProxyHosts: ReadonlySet<string>;
  private readonly allowedProxyOrigins: ReadonlySet<string>;
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
    this.allowedProxyHosts = new Set(
      (viteConfig?.allowedHosts ?? [])
        .map(normalizeHostname)
        .filter((host): host is string => host !== null),
    );
    this.allowedProxyOrigins = new Set(
      (viteConfig?.allowedOrigins ?? [])
        .map(normalizeOrigin)
        .filter((origin): origin is string => origin !== null),
    );
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
      // Dynamically import Vite (ESM)
      const { createServer: createViteServer, version: viteVersion } =
        await import('vite');

      // An OS-assigned free port for the HMR WebSocket avoids conflicts with
      // the external Vite dev server ("Port 5173 is already in use") and
      // with previous hot-reload children. No browser connects to this
      // WebSocket (client HMR goes through the external dev server via the
      // proxy), so the random port is harmless. hmr:{port:0} is not used
      // because Vite 8 treats 0 as unset and binds the fixed default 24678.
      const hmrPort = await getEphemeralPort();
      // configFile is deliberately left unset so Vite discovers and loads the
      // user's vite.config from `root`. This server renders the same components
      // the client hydrates, so it must be built with the same plugins,
      // aliases, `define` values and CSS setup. Pinning it to a fixed inline
      // config instead makes user plugins (Tailwind, svgr, MDX, CSS-in-JS
      // transforms) apply on the client and silently vanish on the server,
      // which surfaces as a hydration mismatch rather than a config error.
      //
      // The values below are merged over that config: `root` and the `@` alias
      // are resolved from nest-cli.json so a monorepo app resolves against its
      // own project directory rather than the workspace cwd.
      const creating = createViteServer({
        root: this.projectPaths.viteRoot,
        resolve: {
          alias: {
            '@': this.projectPaths.aliasAt,
          },
          dedupe: ['react', 'react-dom', '@nestjs-ssr/react'],
        },
        ssr: {
          noExternal: ['@nestjs-ssr/react'],
        },
        server: {
          middlewareMode: true,
          ...websocketPortOption(hmrPort, viteVersion),
        },
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
    } catch (error) {
      this.logger.warn(
        `Failed to initialize Vite: ${getErrorMessage(error)}. Make sure vite is installed.`,
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
        // WebSocket upgrades are subscribed explicitly below instead of via
        // ws:true. http-proxy-middleware only attaches its 'upgrade' listener
        // from inside the HTTP middleware, i.e. after the first proxied HTTP
        // request. After a hot-reload restart the browser reconnects with a
        // WebSocket handshake and nothing else, so the listener would never be
        // attached and the reconnect could never succeed.
        ws: false,
        pathFilter: (
          pathname: string,
          req?: {
            headers?: Record<string, string | string[] | undefined>;
          },
        ) => {
          return (
            pathname.startsWith('/src/') ||
            pathname.startsWith('/@') ||
            pathname.startsWith('/node_modules/') ||
            // Vite's HMR socket handshakes at the base path, so it has to be
            // matched by its subprotocol rather than by its URL.
            isViteWebSocketUpgrade(req)
          );
        },
      });

      // Restrict the proxy to this machine. It forwards /src/*, /@* and
      // /node_modules/* — /@fs/ among them, which reads arbitrary files — to
      // a Vite dev server that binds to localhost only. NestJS binds every
      // interface, so proxying for remote peers would republish the project's
      // sources to the whole network. Remote requests fall through to the
      // application, which answers them as it would any unknown route.
      const guardedProxy = Object.assign(
        (req: any, res: any, next: any) => {
          if (
            !isViteProxyRequestAllowed(
              req,
              this.allowedProxyHosts,
              this.allowedProxyOrigins,
            )
          ) {
            return next();
          }
          return (viteProxy as any)(req, res, next);
        },
        { upgrade: (viteProxy as any).upgrade },
      );

      app.use(guardedProxy);
      this.logger.log(
        `✓ Vite HMR proxy configured (Vite dev server on port ${this.vitePort}` +
          `${this.allowedProxyHosts.size ? ', explicit remote allowlist enabled' : ', loopback only'})`,
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

        // Forward Vite's HMR WebSocket to the dev server. Registered eagerly
        // (see ws:false above) so a browser that reconnects over WebSocket
        // alone after a restart is served straight away. Registered after the
        // tracker so the socket is tracked before it is handed to the proxy.
        //
        // Remote peers get the same treatment as HTTP: a Vite handshake from
        // off-machine is dropped rather than bridged to the dev server. Any
        // other upgrade is handed to the proxy untouched, which no-ops on it
        // and leaves the application's own WebSocket handling intact.
        if (typeof viteProxy.upgrade === 'function') {
          const proxyUpgrade = viteProxy.upgrade;
          httpServer.on(
            'upgrade',
            (req: IncomingMessage, socket: Socket, head: Buffer) => {
              if (
                isViteWebSocketUpgrade(req) &&
                !isViteProxyRequestAllowed(
                  req,
                  this.allowedProxyHosts,
                  this.allowedProxyOrigins,
                )
              ) {
                socket.destroy();
                return;
              }
              proxyUpgrade(req, socket, head);
            },
          );
        }
      }
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
        httpAdapter.useStaticAssets(staticPath, {
          index: false,
          maxAge: '1y',
        });
        this.logger.log('✓ Static assets configured (dist/client) [Express]');
      }
    } catch (error) {
      this.logger.warn(
        `Failed to setup static assets: ${getErrorMessage(error)}`,
      );
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
    } catch (error) {
      this.logger.warn(
        `Failed to close Vite server: ${getErrorMessage(error)}`,
      );
    }
  }
}
