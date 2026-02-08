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

  app.enableShutdownHooks();

  const port = process.env.PORT ? Number(process.env.PORT) : 3022;
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Application running on http://localhost:${port}`);
}

bootstrap();
