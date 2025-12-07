import { Controller, Get } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';

@Controller()
export class AppController {
  @Get()
  @Render('views/home')
  getHome() {
    return {
      message: 'Hello from NestJS SSR!',
      timestamp: new Date().toISOString(),
    };
  }
}
