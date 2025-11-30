import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RenderModule } from './shared/render/render.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [RenderModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
