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
import { RenderService } from './render.service';
import type { ViteConfig } from '../interfaces';
import type { ViteDevServer } from 'vite';

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
  private isShuttingDown = false;

  constructor(
    private readonly renderService: RenderService,
    private readonly httpAdapterHost: HttpAdapterHost,
    @Optional() @Inject('VITE_CONFIG') viteConfig?: ViteConfig,
  ) {
    this.vitePort = viteConfig?.port || 5173;

    // Register signal handlers for cleanup when lifecycle hooks may not fire
    // This handles cases where enableShutdownHooks() wasn't called
    this.registerSignalHandlers();
  }

  private registerSignalHandlers() {
    const cleanup = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      this.logger.log(`Received ${signal}, closing Vite server...`);
      await this.closeViteServer();
    };

    process.once('SIGTERM', () => cleanup('SIGTERM'));
    process.once('SIGINT', () => cleanup('SIGINT'));
  }

  async onModuleInit() {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (isDevelopment) {
      await this.setupDevelopmentMode();
    } else {
      this.setupProductionMode();
    }
  }

  private async setupDevelopmentMode() {
    try {
      // Dynamically import Vite (ESM)
      const { createServer: createViteServer } = await import('vite');

      // Create Vite server for SSR module loading
      this.viteServer = await createViteServer({
        server: { middlewareMode: true },
        appType: 'custom',
      });

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
    } catch (error: any) {
      this.logger.warn(
        `Failed to setup Vite proxy: ${error.message}. Make sure http-proxy-middleware is installed.`,
      );
    }
  }

  private setupProductionMode() {
    try {
      const httpAdapter = this.httpAdapterHost.httpAdapter;
      if (httpAdapter) {
        const app = httpAdapter.getInstance();
        const { join } = require('path');
        const express = require('express');

        // Serve static assets from dist/client
        app.use(
          express.static(join(process.cwd(), 'dist/client'), {
            index: false,
            maxAge: '1y',
          }),
        );

        this.logger.log('✓ Static assets configured (dist/client)');
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

  private async closeViteServer() {
    if (this.isShuttingDown && !this.viteServer) return;
    this.isShuttingDown = true;

    if (this.viteServer) {
      try {
        // Clear render service reference first
        this.renderService.setViteServer(null as any);

        await this.viteServer.close();
        this.viteServer = null;
        this.logger.log('✓ Vite server closed');
      } catch (error: any) {
        this.logger.warn(`Failed to close Vite server: ${error.message}`);
      }
    }
  }
}
