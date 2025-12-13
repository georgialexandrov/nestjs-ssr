import { Controller, Get } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';
import Home from './views/home';

@Controller()
export class AppController {
  @Get()
  @Render(Home)
  getHome() {
    return {
      message: 'Hello from NestJS SSR!',
      timestamp: new Date().toISOString(),
    };
  }
}
