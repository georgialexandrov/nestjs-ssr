import { Controller, Get } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';
import Home from './views/home';
import About from './views/about';

@Controller()
export class AppController {
  @Get()
  @Render(Home)
  getHome() {
    return {
      message: 'Hello from NestJS SSR with Fastify!',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('about')
  @Render(About)
  getAbout() {
    return {
      version: '0.3.5',
      features: [
        'Streaming SSR with renderToPipeableStream',
        'Fastify adapter with automatic detection',
        'Client-side segment navigation (no full page reload)',
        'Automatic layout detection and composition',
        'View Transitions API support (progressive enhancement)',
        'Browser back/forward navigation support',
      ],
    };
  }
}
