import { Controller, Get } from '@nestjs/common';
import { ReactRender } from '@nestjs-ssr/react';

@Controller('showcase')
export class ShowcaseController {
  @Get()
  @ReactRender('users/views/showcase')
  getShowcase() {
    return {
      title: 'NestJS + React SSR Showcase',
      description: 'A comprehensive demonstration of server-side rendering with modern UI components, custom styling, and static assets.',
    };
  }
}
