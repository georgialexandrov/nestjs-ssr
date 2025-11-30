import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ReactRender } from '@nestjs-ssr/react';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ReactRender('app/views/home')
  getHello(): { message: string } {
    return {
      message: this.appService.getHello(),
    };
  }
}
