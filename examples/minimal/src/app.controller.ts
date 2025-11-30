import { Controller, Get } from '@nestjs/common';
import { ReactRender } from '@nestjs-ssr/react';

@Controller()
export class AppController {
  @Get()
  @ReactRender('views/home')
  getHome() {
    return {
      message: 'Hello from NestJS SSR!',
      timestamp: new Date().toISOString(),
    };
  }
}
