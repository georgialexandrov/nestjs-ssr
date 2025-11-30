import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { ReactRender } from './shared/render/decorators/react-render.decorator.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ReactRender('app/views/home')
  getHello() {
    return {
      message: this.appService.getHello(),
    };
  }
}
