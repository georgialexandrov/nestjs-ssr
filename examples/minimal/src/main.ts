import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable graceful shutdown - ensures Vite server closes properly
  app.enableShutdownHooks();

  // Serve static assets in production
  if (process.env.NODE_ENV === 'production') {
    app.useStaticAssets(join(process.cwd(), 'dist/client'), {
      index: false,
      maxAge: '1y',
    });
  }

  await app.listen(3000);
  console.log('Application running on http://localhost:3000');
}

bootstrap();
