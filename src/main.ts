import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createServer as createViteServer } from 'vite';
import { RenderService } from './shared/render/render.service';
import helmet from 'helmet';
import express, { Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure security headers with Helmet.js
  // Note: Disabled in development to avoid HSTS/CSP issues with HMR
  // In production, enables CSP, HSTS, and other security headers
  if (process.env.NODE_ENV === 'production') {
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              'https://fonts.googleapis.com',
            ],
            imgSrc: ["'self'", 'data:', 'https:'],
            fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
          },
        },
        frameguard: {
          action: 'deny',
        },
        hidePoweredBy: true,
        hsts: {
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        },
        noSniff: true,
        referrerPolicy: {
          policy: 'strict-origin-when-cross-origin',
        },
        permittedCrossDomainPolicies: {
          permittedPolicies: 'none',
        },
      }),
    );
  }

  // Environment-aware setup
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const renderService = app.get(RenderService);

  if (isDevelopment) {
    // Development: Proxy to external Vite server for client-side assets and HMR
    // This prevents NestJS restarts from affecting Vite's HMR connection
    const { createProxyMiddleware } = await import('http-proxy-middleware');

    // Proxy client-side requests to external Vite dev server on port 5173
    // Proxy Vite-specific paths (modules, HMR, public assets)
    const viteProxy = createProxyMiddleware({
      target: 'http://localhost:5173',
      changeOrigin: true,
      ws: true, // Enable WebSocket proxying for HMR
      pathFilter: (pathname: string) => {
        return (
          pathname.startsWith('/src/') ||
          pathname.startsWith('/@') ||
          pathname.startsWith('/node_modules/') ||
          pathname.startsWith('/images/') || // Public directory assets
          /\.(jpg|jpeg|png|gif|svg|webp|ico)$/.test(pathname) // Image files
        );
      },
    });
    app.use(viteProxy);

    // Create Vite instance for SSR module loading (not for middleware)
    // This allows server-side rendering to load React components
    process.env.VITE_MIDDLEWARE = 'true';
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    renderService.setViteServer(vite);
    console.log('🔥 Vite dev server proxy enabled (HMR via port 5173)');
  } else {
    // Production: Serve static files from dist/client with cache headers
    app.use(
      '/assets',
      express.static('dist/client/assets', {
        setHeaders: (res: Response, path: string) => {
          // Check if file has hash in filename (e.g., main.abc123.js)
          const hasHash = /\.[a-f0-9]{8,}\.(js|css)/.test(path);

          if (hasHash) {
            // Immutable assets with content hash - cache for 1 year
            res.setHeader(
              'Cache-Control',
              'public, max-age=31536000, immutable',
            );
          } else {
            // Assets without hash - cache for 1 hour with revalidation
            res.setHeader(
              'Cache-Control',
              'public, max-age=3600, must-revalidate',
            );
          }
        },
      }),
    );
    console.log('📦 Serving static assets from dist/client');
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
