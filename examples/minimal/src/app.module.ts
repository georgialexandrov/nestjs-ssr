import { Module } from '@nestjs/common';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';

@Module({
  imports: [
    RenderModule, // Zero config - embedded mode by default (no HMR, simplest setup)
  ],
  controllers: [AppController],
})
export class AppModule {}
