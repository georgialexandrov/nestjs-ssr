import { Module } from '@nestjs/common';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Proxy mode - Vite runs as separate server with true HMR
    // Run with: pnpm start:dev (runs both Vite and NestJS)
    RenderModule.register({
      vite: { mode: 'proxy', port: 5173 },
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
