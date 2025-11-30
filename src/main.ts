import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createServer as createViteServer } from 'vite';
import { RenderService } from './shared/render/render.service';
import helmet from 'helmet';

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
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
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

  // Create Vite dev server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });

  // Get RenderService and set Vite server
  const renderService = app.get(RenderService);
  renderService.setViteServer(vite);

  // Use Vite's middleware for HMR and dev assets
  app.use(vite.middlewares);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
