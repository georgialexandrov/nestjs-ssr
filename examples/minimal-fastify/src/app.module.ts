import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';
import { UsersController } from './users.controller';
import { SimpleAuthGuard } from './auth.guard';

@Module({
  imports: [
    // Streaming SSR mode with Fastify adapter
    // ViteInitializerService auto-detects Fastify and configures accordingly
    RenderModule.forRoot({
      mode: 'stream',
      vite: { port: 5174 },
      context: ({ req }) => ({
        user: req.user,
      }),
    }),
  ],
  controllers: [AppController, UsersController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SimpleAuthGuard,
    },
  ],
})
export class AppModule {}
