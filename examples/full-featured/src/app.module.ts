import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RenderModule } from '@nestjs-ssr/react';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // SSR rendering - errors are logged via NestJS Logger
    // For custom error handling, implement a global exception filter
    RenderModule.register(),
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
