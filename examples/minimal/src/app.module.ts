import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';
import { SimpleAuthGuard } from './auth.guard';

@Module({
  imports: [
    // Vite runs as separate server with HMR
    // Run with: pnpm start:dev (runs both Vite and NestJS concurrently)
    RenderModule.forRoot({
      // Context factory enriches RenderContext with custom properties
      // These become available in React components via usePageContext()
      context: ({ req }) => ({
        // Pass user from auth guard to React components
        // In a real app, this comes from JWT/Passport authentication
        user: req.user,
        bau: 'bau',
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    // Register auth guard globally - runs before every request
    // Sets req.user which is then passed to context factory
    {
      provide: APP_GUARD,
      useClass: SimpleAuthGuard,
    },
  ],
})
export class AppModule {}
