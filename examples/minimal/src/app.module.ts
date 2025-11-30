import { Module } from '@nestjs/common';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';

@Module({
  imports: [
    RenderModule.register(), // Zero-config!
  ],
  controllers: [AppController],
})
export class AppModule {}
