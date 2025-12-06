import { Controller, Get } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';

export interface PageData {
  message: string;
  items: Array<{ id: number; name: string; description: string }>;
}

@Controller()
export class AppController {
  @Get()
  @Render('views/home')
  getHome(): PageData {
    return {
      message: 'Welcome to NestJS SSR with React',
      items: Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        description: `This is item number ${i + 1}`,
      })),
    };
  }
}
