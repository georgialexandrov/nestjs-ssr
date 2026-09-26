import { Controller, Get } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';
import Welcome from './views/welcome';

/**
 * Starter page created by `nestjs-ssr init`. Safe to delete together with
 * src/views/welcome.tsx once you have pages of your own.
 */
@Controller('welcome')
export class WelcomeController {
  @Get()
  @Render(Welcome)
  welcome() {
    return {
      renderedAt: new Date().toISOString(),
      head: { title: 'Welcome · NestJS + React' },
    };
  }
}
