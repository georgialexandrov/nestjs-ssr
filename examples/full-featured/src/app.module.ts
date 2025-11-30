import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RenderModule, MonitoringModule } from '@nestjs-ssr/react';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Error monitoring (must be first to catch all errors)
    MonitoringModule.forRoot(),
    // SSR rendering (string mode by default, set SSR_MODE=stream for streaming)
    RenderModule.register(),
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
