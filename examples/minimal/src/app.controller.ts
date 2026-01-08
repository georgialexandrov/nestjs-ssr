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
      message: 'Hello from NestJS SSR!',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('about')
  @Render(About)
  getAbout() {
    return {
      version: '0.2.5',
      features: [
        'Server-side rendering with React 19',
        'Client-side segment navigation (no full page reload)',
        'Automatic layout detection and composition',
        'View Transitions API support (progressive enhancement)',
        'Browser back/forward navigation support',
        'Programmatic navigation via useNavigate() hook',
      ],
    };
  }
}
