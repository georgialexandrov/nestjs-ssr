import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';
import { RecipesController } from './recipes.controller';
import { ChefsController } from './chefs.controller';
import { SpecialsController } from './specials/specials.controller';
import { RecipesService } from './recipes.service';
import { ChefsService } from './chefs.service';
import { SimpleAuthGuard } from './auth.guard';

@Module({
  imports: [
    RenderModule.forRoot({
      vite: { port: 5178 },
      // Rendered routes offer HTML and, where a controller provides one, a
      // JSON representation. Declaring securityHeaders also turns on the
      // response-policy stage, which is off until an application asks.
      representation: {
        json: true,
        securityHeaders: { referrerPolicy: 'strict-origin-when-cross-origin' },
      },
      // Exposed to the browser in context.headers / context.cookies.
      allowedHeaders: ['accept-language'],
      allowedCookies: ['theme'],
      context: ({ req }) => ({
        user: req.user,
      }),
      // The context factory hands over whatever the guard attached; this hook
      // decides what part of it is safe to publish to the browser.
      projectContext: ({ context }) => {
        const user = (context as { user?: { id: string; name: string } }).user;
        return {
          ...context,
          user: user ? { id: user.id, name: user.name } : undefined,
        };
      },
    }),
  ],
  controllers: [
    AppController,
    RecipesController,
    ChefsController,
    SpecialsController,
  ],
  providers: [
    RecipesService,
    ChefsService,
    {
      provide: APP_GUARD,
      useClass: SimpleAuthGuard,
    },
  ],
})
export class AppModule {}
