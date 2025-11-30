import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RenderModule } from './shared/render/render.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [RenderModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
