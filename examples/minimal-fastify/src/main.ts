import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Enable graceful shutdown - ensures Vite server closes properly
  app.enableShutdownHooks();

  // In production, static file serving is handled automatically by
  // ViteInitializerService which detects Fastify and registers @fastify/static

  await app.listen({ port: 3001, host: '0.0.0.0' });
  console.log('Application running on http://localhost:3001');
}

bootstrap();
