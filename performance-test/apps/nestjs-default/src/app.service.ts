import { Injectable } from '@nestjs/common';

export interface PageData {
  message: string;
  items: Array<{ id: number; name: string; description: string }>;
}

@Injectable()
export class AppService {
  getPageData(): PageData {
    return {
      message: 'Welcome to NestJS with Pug Templates',
      items: Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        description: `This is item number ${i + 1}`,
      })),
    };
  }
}
