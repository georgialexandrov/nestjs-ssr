import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RenderService } from '@nestjs-ssr/react';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
  }

  await app.listen(process.env.PORT ?? 3000);
  console.log(`NestJS SSR (React) running on http://localhost:${process.env.PORT ?? 3000}`);
}

bootstrap();
