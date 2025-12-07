import { Injectable, OnModuleInit, Logger, Inject, Optional } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { RenderService } from './render.service';
import type { ViteConfig } from '../interfaces';

/**
 * Automatically initializes Vite in development or static assets in production
 */
@Injectable()
export class ViteInitializerService implements OnModuleInit {
  private readonly logger = new Logger(ViteInitializerService.name);
  private readonly viteMode: 'proxy' | 'embedded';
  private readonly vitePort: number;

  constructor(
    private readonly renderService: RenderService,
    private readonly httpAdapterHost: HttpAdapterHost,
    @Optional() @Inject('VITE_CONFIG') private readonly viteConfig?: ViteConfig,
  ) {
    // Default to proxy mode with port 5173
    this.viteMode = viteConfig?.mode || 'proxy';
    this.vitePort = viteConfig?.port || 5173;
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
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'custom',
      });

      this.renderService.setViteServer(vite);
      this.logger.log(`✓ Vite initialized for SSR (mode: ${this.viteMode})`);

      // Set up proxy middleware for HMR (proxy mode only)
      if (this.viteMode === 'proxy') {
        await this.setupViteProxy();
      }
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
        this.logger.warn('HTTP adapter not available, skipping Vite proxy setup');
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
      this.logger.log(`✓ Vite HMR proxy configured (external Vite on port ${this.vitePort})`);
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
}
