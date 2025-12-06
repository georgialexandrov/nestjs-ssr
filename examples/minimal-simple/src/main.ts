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
    // Development: Use Vite middleware for both SSR and serving assets
    // Note: This approach provides file watching and auto-restart, but NOT hot module replacement (HMR)
    // For HMR support, see the 'minimal' example with separate Vite dev server
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    // Use Vite middleware to serve client-side assets
    app.use(vite.middlewares);

    // Set Vite instance for SSR
    renderService.setViteServer(vite);
    console.log('⚡️ Vite middleware enabled (auto-restart on file changes)');
  }

  await app.listen(3000);
  console.log(`Application is running on: http://localhost:3000`);
}

bootstrap();
