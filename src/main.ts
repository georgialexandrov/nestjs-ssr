import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createServer as createViteServer } from 'vite';
import { RenderService } from './shared/render/render.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
