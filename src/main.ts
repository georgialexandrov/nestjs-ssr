import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createServer as createViteServer } from 'vite';
import { RenderService } from './shared/render/render.service';
import helmet from 'helmet';
import express, { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure security headers with Helmet.js
  // Note: CSP allows 'unsafe-inline' for scripts due to SSR hydration needs
  // In production, consider using nonces for better security
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            // Required for SSR: Inline scripts for hydration data
            // (__INITIAL_STATE__, __COMPONENT_PATH__, __CONTEXT__)
            "'unsafe-inline'",
            // For Vite dev server HMR in development
            ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
          ],
          styleSrc: [
            "'self'",
            // Required for inline styles (both SSR and Vite HMR)
            "'unsafe-inline'",
          ],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: [
            "'self'",
            // For Vite HMR WebSocket in development
            ...(process.env.NODE_ENV === 'development'
              ? ['ws://localhost:*', 'ws://127.0.0.1:*']
              : []),
          ],
          objectSrc: ["'none'"],
          // Explicitly disable upgrade-insecure-requests for localhost development
          // Only enable in production when actual HTTPS is configured
          ...(process.env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : { upgradeInsecureRequests: null }),
        },
      },
      // Prevent clickjacking attacks
      frameguard: {
        action: 'deny',
      },
      // Hide X-Powered-By header
      hidePoweredBy: true,
      // Enforce HTTPS in production
      hsts: process.env.NODE_ENV === 'production'
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false,
      // Prevent MIME-sniffing
      noSniff: true,
      // Referrer policy for privacy
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
      // Control browser features
      permittedCrossDomainPolicies: {
        permittedPolicies: 'none',
      },
    }),
  );

  // Add cache headers for static assets (before Vite middleware)
  // In development, Vite handles assets. In production, use these headers.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const url = req.url;

    // Only set cache headers for static assets, not for HTML pages
    if (/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/.test(url)) {
      // Check if file has hash in filename (e.g., main.abc123.js)
      const hasHash = /\.[a-f0-9]{8,}\.(js|css)/.test(url);

      if (hasHash) {
        // Immutable assets with content hash - cache for 1 year
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        // Assets without hash - cache for 1 hour with revalidation
        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      }

      // Continue to the static file handler
      return next();
    }

    // For non-static-asset requests, just continue
    next();
  });

  // Environment-aware setup
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const renderService = app.get(RenderService);

  if (isDevelopment) {
    // Development: Use Vite dev server for HMR and on-the-fly transformation
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    renderService.setViteServer(vite);
    app.use(vite.middlewares);
    console.log('🔥 Vite dev server enabled (HMR active)');
  } else {
    // Production: Serve static files from dist/client
    app.use('/assets', express.static('dist/client/assets'));
    console.log('📦 Serving static assets from dist/client');
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
