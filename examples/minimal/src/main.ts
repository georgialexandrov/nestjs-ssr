import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable graceful shutdown - ensures Vite server closes properly
  app.enableShutdownHooks();

  await app.listen(3000);
  console.log('Application running on http://localhost:3000');
}

bootstrap();
