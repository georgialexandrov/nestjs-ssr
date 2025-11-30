import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Response } from 'express';
import { RenderService } from './render.service.js';
import { REACT_RENDER_KEY } from './decorators/react-render.decorator.js';

@Injectable()
export class RenderInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private renderService: RenderService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const viewPath = this.reflector.get<string>(
      REACT_RENDER_KEY,
      context.getHandler(),
    );

    if (!viewPath) {
      // No @ReactRender decorator, proceed normally
      return next.handle();
    }

    return next.handle().pipe(
      switchMap(async (data) => {
        const response = context.switchToHttp().getResponse<Response>();

        try {
          // Render the React component
          const html = await this.renderService.render(viewPath, data);

          // Send the HTML response
          response.type('text/html');
          response.send(html);
        } catch (error) {
          console.error('Error rendering React component:', error);
          response.status(500).send('Internal Server Error');
        }

        // Return empty to prevent default response handling
        return;
      }),
    );
  }
}
