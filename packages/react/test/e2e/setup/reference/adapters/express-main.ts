import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableShutdownHooks();

  if (process.env.NODE_ENV === 'production') {
    app.useStaticAssets(join(process.cwd(), 'dist/client'), {
      index: false,
      maxAge: '1y',
    });
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3021;
  await app.listen(port);
  console.log(`Application running on http://localhost:${port}`);
}

bootstrap();
