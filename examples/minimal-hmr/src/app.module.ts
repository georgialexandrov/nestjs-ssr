import { Module } from '@nestjs/common';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Proxy mode (default) - external Vite with HMR
    RenderModule.register({
      vite: { mode: 'proxy', port: 5173 },
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
