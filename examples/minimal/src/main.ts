import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createServer as createViteServer } from 'vite';
import { RenderService } from '@nestjs-ssr/react';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Environment-aware setup
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const renderService = app.get(RenderService);

  if (isDevelopment) {
    // Development: Proxy to external Vite server for client-side assets and HMR
    const { createProxyMiddleware } = await import('http-proxy-middleware');

    // Proxy client-side requests to external Vite dev server on port 5173
    const viteProxy = createProxyMiddleware({
      target: 'http://localhost:5173',
      changeOrigin: true,
      ws: true, // Enable WebSocket proxying for HMR
      pathFilter: (pathname: string) => {
        return (
          pathname.startsWith('/src/') ||
          pathname.startsWith('/@') ||
          pathname.startsWith('/node_modules/')
        );
      },
    });
    app.use(viteProxy);

    // Create Vite instance for SSR module loading (not for middleware)
    process.env.VITE_MIDDLEWARE = 'true';
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    renderService.setViteServer(vite);
    console.log('🔥 Vite dev server proxy enabled (HMR via port 5173)');
  }

  await app.listen(3000);
  console.log(`Application is running on: http://localhost:3000`);
}

bootstrap();
