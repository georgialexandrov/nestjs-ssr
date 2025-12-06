import { Controller, Get, Render } from '@nestjs/common';
import { AppService } from './app.service';
import type { PageData } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Render('index')
  getHome(): PageData {
    return this.appService.getPageData();
  }
}
