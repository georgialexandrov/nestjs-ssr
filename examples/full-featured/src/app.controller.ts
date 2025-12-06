import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Render } from '@nestjs-ssr/react';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Render('app/views/home')
  getHello(): { message: string } {
    return {
      message: this.appService.getHello(),
    };
  }
}
