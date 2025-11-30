import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  Inject,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ERROR_REPORTER } from '../constants';
import type { ErrorReporter } from '../interfaces';

/**
 * Global exception filter that catches all unhandled exceptions
 * and reports them via the ErrorReporter.
 *
 * This filter provides:
 * - Automatic error reporting with rich context
 * - Consistent error response format
 * - Proper HTTP status codes
 * - Request metadata capture
 */
@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(ERROR_REPORTER) private readonly errorReporter: ErrorReporter,
  ) {}

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    // Report error with rich context
    this.errorReporter.reportError(exception, {
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

    // Send consistent error response
    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
