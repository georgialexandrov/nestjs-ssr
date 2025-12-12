import { Module } from '@nestjs/common';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';

@Module({
  imports: [
    RenderModule.register({
      // Allow theme cookie to be passed to client for SSR
      allowedCookies: ['theme'],
      // Example: Allow custom headers if needed
      // allowedHeaders: ['x-tenant-id'],
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
