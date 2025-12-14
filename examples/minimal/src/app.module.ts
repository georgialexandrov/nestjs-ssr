import { Module } from '@nestjs/common';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Vite runs as separate server with HMR
    // Run with: pnpm start:dev (runs both Vite and NestJS concurrently)
    RenderModule.forRoot(),
  ],
  controllers: [AppController],
})
export class AppModule {}
