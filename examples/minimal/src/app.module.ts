import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';
import { RecipesController } from './recipes.controller';
import { ChefsController } from './chefs.controller';
import { RecipesService } from './recipes.service';
import { ChefsService } from './chefs.service';
import { SimpleAuthGuard } from './auth.guard';

@Module({
  imports: [
    RenderModule.forRoot({
      vite: { port: 5178 },
      context: ({ req }) => ({
        user: req.user,
      }),
    }),
  ],
  controllers: [AppController, RecipesController, ChefsController],
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
