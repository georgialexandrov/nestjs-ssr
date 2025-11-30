import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { RenderService } from './render.service';
import { REACT_RENDER_KEY } from './decorators/react-render.decorator';
import type { RenderContext } from './interfaces/index';

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
        const httpContext = context.switchToHttp();
        const request = httpContext.getRequest<Request>();
        const response = httpContext.getResponse<Response>();

        // Build render context from request
        const renderContext: RenderContext = {
          url: request.url,
          path: request.path,
          query: request.query as Record<string, string | string[]>,
          params: request.params as Record<string, string>,
          userAgent: request.headers['user-agent'],
          acceptLanguage: request.headers['accept-language'],
          referer: request.headers.referer,
        };

        // Merge controller data with context
        const fullData = {
          data,
          __context: renderContext,
        };

        try {
          // Render the React component
          const html = await this.renderService.render(viewPath, fullData);

          // Set content type and let NestJS handle sending the response
          response.type('text/html');
          return html;
        } catch (error) {
          console.error('Error rendering React component:', error);
          response.status(500);
          return 'Internal Server Error';
        }
      }),
    );
  }
}
