import { Module } from '@nestjs/common';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Embedded mode - simplest setup, no HMR
    RenderModule.register({
      vite: { mode: 'embedded' },
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
