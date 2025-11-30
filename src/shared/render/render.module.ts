import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RenderService } from './render.service.js';
import { RenderInterceptor } from './render.interceptor.js';

@Global()
@Module({
  providers: [
    RenderService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RenderInterceptor,
    },
  ],
  exports: [RenderService],
})
export class RenderModule {}
