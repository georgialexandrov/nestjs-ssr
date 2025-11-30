import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { RenderService } from './render.service';
import { REACT_RENDER_KEY } from '../decorators/react-render.decorator';
import type { RenderContext } from '../interfaces/index';
import { ERROR_REPORTER } from '../monitoring/constants';
import type { ErrorReporter } from '../monitoring/interfaces';

@Injectable()
export class RenderInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private renderService: RenderService,
    @Inject(ERROR_REPORTER) private readonly errorReporter: ErrorReporter,
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
          // Pass response object for streaming mode support
          const html = await this.renderService.render(viewPath, fullData, response);

          // In streaming mode, render() returns void and handles response directly
          // In string mode, render() returns HTML string
          if (html !== undefined) {
            // String mode: Set content type and let NestJS handle sending the response
            response.type('text/html');
            return html;
          }

          // Streaming mode: Response already sent, return empty to prevent NestJS from sending again
          return;
        } catch (error) {
          // Report error with rich context
          this.errorReporter.reportError(error as Error, {
            viewPath,
            componentPath: viewPath,
            url: request.url,
            method: request.method,
            params: request.params as Record<string, string>,
            query: request.query as Record<string, string | string[]>,
            headers: {
              ...(request.headers['user-agent'] && {
                'user-agent': request.headers['user-agent'],
              }),
              ...(request.headers.referer && {
                referer: request.headers.referer,
              }),
            },
            userAgent: request.headers['user-agent'],
            referer: request.headers.referer,
            userId: (request as any).user?.id,
            environment: process.env.NODE_ENV,
            timestamp: new Date().toISOString(),
          });

          response.status(500);
          return 'Internal Server Error';
        }
      }),
    );
  }
}
