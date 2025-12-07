import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { RenderService } from '@nestjs-ssr/react';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Environment-aware setup
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const renderService = app.get(RenderService);

  if (isDevelopment) {
    // Development: Create Vite instance for SSR module loading
    const viteModule = await import('vite');
    const vite = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    renderService.setViteServer(vite);
    console.log('🔥 Vite dev server enabled for SSR');
  } else {
    // Production: Serve static assets from dist/client
    const clientPath = join(process.cwd(), 'dist/client');
    app.useStaticAssets(clientPath, {
      index: false, // Don't serve index.html automatically
      maxAge: '1y', // Cache static assets for 1 year
    });
    console.log('📦 Serving static assets from dist/client');
  }

  await app.listen(process.env.PORT ?? 3000);
  console.log(`NestJS SSR (React) running on http://localhost:${process.env.PORT ?? 3000}`);
}

bootstrap();
