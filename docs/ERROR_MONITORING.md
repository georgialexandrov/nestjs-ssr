# Error Monitoring & Reporting

This document describes the error monitoring system implemented in the NestJS + React SSR framework.

## Overview

The framework provides a **pluggable error monitoring system** that allows developers to integrate any error reporting service (Sentry, Datadog, OpenTelemetry, custom solutions, etc.) without modifying framework code.

**Key Features:**
- ✅ Minimal interface (single method: `reportError()`)
- ✅ Works out of the box (default console logging with NestJS Logger)
- ✅ Easy to swap implementations (one-line change)
- ✅ Server-side + Client-side coverage
- ✅ Automatic error capture (no manual try/catch needed)
- ✅ Rich context enrichment (request, user, component data)
- ✅ Type-safe throughout

## Architecture

### Server-Side Error Reporting

The server uses NestJS's built-in dependency injection and exception filtering:

```
Error occurs → GlobalExceptionFilter catches → ErrorReporter.reportError() → Sentry/Datadog/Console
```

**Components:**

1. **ErrorReporter Interface** (`src/shared/monitoring/interfaces/error-reporter.interface.ts`)
   - Single method: `reportError(error: Error, context?: ErrorContext)`
   - Easy to implement for any service

2. **ConsoleErrorReporter** (`src/shared/monitoring/reporters/console-error-reporter.ts`)
   - Default implementation using NestJS `Logger`
   - Works out of the box, no configuration needed

3. **GlobalExceptionFilter** (`src/shared/monitoring/filters/global-exception.filter.ts`)
   - Catches ALL unhandled exceptions
   - Enriches errors with request context (URL, method, params, headers, user)
   - Sends to ErrorReporter

4. **MonitoringModule** (`src/shared/monitoring/monitoring.module.ts`)
   - Global module with `forRoot()` pattern
   - Configures error reporter via dependency injection

### Client-Side Error Reporting

The client uses React Error Boundaries and a global error reporter:

```
Error in React → ErrorBoundary catches → ClientErrorReporter.reportError() → Server API / Sentry / Console
```

**Components:**

1. **ClientErrorReporter Interface** (`src/view/error-reporter.ts`)
   - Mirrors server interface for consistency
   - Single method: `reportError(error: Error, context?: ClientErrorContext)`

2. **DefaultClientErrorReporter** (`src/view/error-reporter.ts`)
   - Sends errors to server endpoint (`POST /api/errors`)
   - Falls back to console if fetch fails
   - Logs to console in development

3. **ConsoleClientErrorReporter** (`src/view/error-reporter.ts`)
   - Console-only logging (no server communication)
   - Useful for development or when no server endpoint exists

4. **ErrorBoundary** (`src/shared/views/error-boundary.tsx`)
   - Catches React component errors
   - Reports via `getErrorReporter()`
   - Shows user-friendly fallback UI

## Default Behavior (Out of the Box)

**Server:**
- Uses `ConsoleErrorReporter` with NestJS `Logger`
- Logs errors to stdout with rich context
- Follows NestJS logging conventions

**Client:**
- Uses `DefaultClientErrorReporter`
- Attempts to POST errors to `/api/errors`
- Falls back to console logging
- Logs to console in development mode

## Usage

### 1. Basic Setup (Default Logging)

The framework works out of the box with console logging:

```typescript
// src/app.module.ts
import { MonitoringModule } from './shared/monitoring';

@Module({
  imports: [
    MonitoringModule.forRoot(), // Uses default ConsoleErrorReporter
    // ... other modules
  ],
})
export class AppModule {}
```

**That's it!** All server errors are now automatically logged with NestJS Logger.

### 2. Integrate Sentry (Server + Client)

#### Server-Side Sentry

```typescript
// src/monitoring/sentry-error-reporter.ts
import { Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { ErrorReporter, ErrorContext } from '@shared/monitoring';

@Injectable()
export class SentryErrorReporter implements ErrorReporter {
  constructor() {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
    });
  }

  reportError(error: Error, context?: ErrorContext): void {
    Sentry.captureException(error, {
      contexts: {
        custom: context,
      },
      user: context?.userId ? { id: context.userId } : undefined,
      tags: {
        url: context?.url,
        method: context?.method,
        componentPath: context?.componentPath,
      },
    });
  }
}
```

```typescript
// src/app.module.ts
import { MonitoringModule } from './shared/monitoring';
import { SentryErrorReporter } from './monitoring/sentry-error-reporter';

@Module({
  imports: [
    MonitoringModule.forRoot({
      errorReporter: SentryErrorReporter, // One-line change!
    }),
    // ... other modules
  ],
})
export class AppModule {}
```

#### Client-Side Sentry

```typescript
// src/view/monitoring/sentry-client-reporter.ts
import * as Sentry from '@sentry/browser';
import type { ClientErrorReporter, ClientErrorContext } from '@view/error-reporter';

export class SentryClientErrorReporter implements ClientErrorReporter {
  constructor() {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
    });
  }

  reportError(error: Error, context?: ClientErrorContext): void {
    Sentry.captureException(error, {
      contexts: { custom: context },
      tags: {
        componentPath: context?.componentPath,
      },
    });
  }
}
```

```typescript
// src/view/entry-client.tsx (or app.tsx)
import { setErrorReporter } from '@view/error-reporter';
import { SentryClientErrorReporter } from './monitoring/sentry-client-reporter';

// Set custom error reporter before app starts
setErrorReporter(new SentryClientErrorReporter());
```

### 3. Integrate Datadog

```typescript
// src/monitoring/datadog-error-reporter.ts
import { Injectable, Logger } from '@nestjs/common';
import type { ErrorReporter, ErrorContext } from '@shared/monitoring';

@Injectable()
export class DatadogErrorReporter implements ErrorReporter {
  private readonly logger = new Logger(DatadogErrorReporter.name);

  reportError(error: Error, context?: ErrorContext): void {
    // Datadog automatically picks up logs from NestJS Logger
    // Just add structured context
    this.logger.error(
      {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        context,
        // Datadog-specific fields
        dd: {
          trace_id: context?.['dd.trace_id'],
          span_id: context?.['dd.span_id'],
        },
      },
      error.stack,
    );
  }
}
```

### 4. Integrate OpenTelemetry

```typescript
// src/monitoring/otel-error-reporter.ts
import { Injectable } from '@nestjs/common';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import type { ErrorReporter, ErrorContext } from '@shared/monitoring';

@Injectable()
export class OpenTelemetryErrorReporter implements ErrorReporter {
  reportError(error: Error, context?: ErrorContext): void {
    const tracer = trace.getTracer('nest-ssr-framework');
    const span = tracer.startSpan('error', {
      attributes: {
        'error.name': error.name,
        'error.message': error.message,
        'error.stack': error.stack,
        'http.url': context?.url,
        'http.method': context?.method,
        'component.path': context?.componentPath,
        'user.id': context?.userId,
      },
    });

    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });

    span.recordException(error);
    span.end();
  }
}
```

### 5. Custom Server Endpoint for Client Errors

If you want to handle client errors on the server (e.g., log them, send to monitoring):

```typescript
// src/monitoring/monitoring.controller.ts
import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ERROR_REPORTER } from '@shared/monitoring/constants';
import type { ErrorReporter } from '@shared/monitoring';
import { Inject } from '@nestjs/common';

interface ClientError {
  name: string;
  message: string;
  stack?: string;
  context?: any;
}

@Controller('api/errors')
export class MonitoringController {
  constructor(
    @Inject(ERROR_REPORTER) private readonly errorReporter: ErrorReporter,
  ) {}

  @Post()
  @HttpCode(204)
  reportClientError(@Body() errorData: ClientError): void {
    // Reconstruct error object
    const error = new Error(errorData.message);
    error.name = errorData.name;
    error.stack = errorData.stack;

    // Report using the same server-side reporter
    this.errorReporter.reportError(error, {
      ...errorData.context,
      // Mark as client-side error
      source: 'client',
    });
  }
}
```

```typescript
// src/monitoring/monitoring.module.ts
import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';

@Module({
  controllers: [MonitoringController],
})
export class MonitoringControllerModule {}
```

```typescript
// src/app.module.ts
@Module({
  imports: [
    MonitoringModule.forRoot(),
    MonitoringControllerModule, // Add controller module
    // ...
  ],
})
export class AppModule {}
```

## Error Context Reference

### Server-Side ErrorContext

Captured automatically by `GlobalExceptionFilter`, `RenderInterceptor`, and `RenderService`:

```typescript
interface ErrorContext {
  // HTTP Request
  url?: string;                            // e.g., "/users/123"
  method?: string;                         // e.g., "GET"
  params?: Record<string, string>;         // e.g., { id: "123" }
  query?: Record<string, string | string[]>; // e.g., { tab: "posts" }
  headers?: Record<string, string>;        // e.g., { "user-agent": "..." }
  userId?: string;                         // From request.user.id (if authenticated)
  userAgent?: string;                      // Browser user agent
  referer?: string;                        // HTTP referer

  // Component/View (SSR errors)
  componentPath?: string;                  // e.g., "users/views/user-profile"
  viewPath?: string;                       // e.g., "users/views/user-profile"

  // React-specific
  componentStack?: string;                 // React component stack trace

  // Metadata
  environment?: string;                    // "development" | "production"
  timestamp?: string;                      // ISO 8601 timestamp

  // Custom (extend as needed)
  [key: string]: any;
}
```

### Client-Side ClientErrorContext

Captured by `ErrorBoundary` and enriched by `DefaultClientErrorReporter`:

```typescript
interface ClientErrorContext {
  // Component
  componentPath?: string;                  // From window.__COMPONENT_PATH__
  componentStack?: string;                 // React component stack

  // Browser
  url?: string;                            // window.location.href
  userAgent?: string;                      // navigator.userAgent

  // Metadata
  environment?: string;                    // "development" | "production"
  timestamp?: string;                      // ISO 8601 timestamp

  // Custom
  [key: string]: any;
}
```

## Testing

### Test Server-Side Error Reporting

Create a test controller that throws an error:

```typescript
// src/app.controller.ts
@Get('test-error')
testError() {
  throw new Error('This is a test error');
}
```

Visit `http://localhost:3000/test-error` and check your logs/monitoring service.

### Test SSR Rendering Errors

Create a view that throws during render:

```typescript
// src/app/views/error-test.tsx
export default function ErrorTest() {
  throw new Error('SSR rendering error test');
  return <div>This will not render</div>;
}
```

Register it and navigate to it. The error should be caught by `RenderInterceptor`.

### Test Client-Side Errors

Add a button that throws an error:

```typescript
// In any view
<button onClick={() => { throw new Error('Client-side test error'); }}>
  Trigger Error
</button>
```

Click the button. The `ErrorBoundary` should catch it and report it.

## Best Practices

### 1. Always Use MonitoringModule.forRoot() First

Place `MonitoringModule.forRoot()` **first** in your imports array so the global exception filter is registered before other modules:

```typescript
@Module({
  imports: [
    MonitoringModule.forRoot(), // FIRST!
    RenderModule,
    UsersModule,
  ],
})
export class AppModule {}
```

### 2. Don't Catch Errors Unnecessarily

The framework automatically catches:
- All server exceptions (via `GlobalExceptionFilter`)
- All SSR rendering errors (via `RenderInterceptor` and `RenderService`)
- All React component errors (via `ErrorBoundary`)

**Don't add manual try/catch** unless you want to handle specific errors differently.

### 3. Enrich Context When Needed

You can manually report errors with custom context:

```typescript
// In a service
import { Inject } from '@nestjs/common';
import { ERROR_REPORTER } from '@shared/monitoring/constants';
import type { ErrorReporter } from '@shared/monitoring';

@Injectable()
export class PaymentService {
  constructor(
    @Inject(ERROR_REPORTER) private readonly errorReporter: ErrorReporter,
  ) {}

  async processPayment(userId: string, amount: number) {
    try {
      // Payment logic
    } catch (error) {
      // Report with custom context
      this.errorReporter.reportError(error as Error, {
        userId,
        paymentAmount: amount,
        paymentGateway: 'stripe',
      });
      throw error; // Re-throw to let GlobalExceptionFilter handle HTTP response
    }
  }
}
```

### 4. Use Environment Variables for Secrets

Never hardcode API keys or DSNs:

```typescript
// ❌ Bad
Sentry.init({ dsn: 'https://abc123...' });

// ✅ Good
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

### 5. Disable Client → Server Reporting in Development

To avoid noise in development, use `ConsoleClientErrorReporter`:

```typescript
// src/view/entry-client.tsx
import { setErrorReporter, ConsoleClientErrorReporter } from '@view/error-reporter';

if (process.env.NODE_ENV === 'development') {
  setErrorReporter(new ConsoleClientErrorReporter());
}
```

## Extending the System

### Add Custom Error Metadata

You can extend `ErrorContext` by adding custom fields:

```typescript
// In GlobalExceptionFilter or custom code
this.errorReporter.reportError(error, {
  url: request.url,
  // ... standard fields

  // Custom fields
  tenantId: request.headers['x-tenant-id'],
  requestId: request.headers['x-request-id'],
  ipAddress: request.ip,
});
```

All custom fields are preserved and passed to your error reporter.

### Create Domain-Specific Reporters

You can create multiple reporters for different parts of your app:

```typescript
// src/payments/payment-error-reporter.ts
@Injectable()
export class PaymentErrorReporter implements ErrorReporter {
  reportError(error: Error, context?: ErrorContext): void {
    // Send to payment monitoring service
    PaymentMonitoring.captureException(error, context);

    // Also log locally
    console.error('[PAYMENT ERROR]', error, context);
  }
}
```

```typescript
// src/payments/payments.module.ts
@Module({
  providers: [
    {
      provide: ERROR_REPORTER,
      useClass: PaymentErrorReporter, // Override for this module
    },
  ],
})
export class PaymentsModule {}
```

## Troubleshooting

### Errors Not Being Reported

1. **Check MonitoringModule is imported**: Ensure `MonitoringModule.forRoot()` is in `AppModule.imports`
2. **Check it's first in imports**: Place it before other modules
3. **Check error reporter logs**: The default `ConsoleErrorReporter` should log to console

### Client Errors Not Reaching Server

1. **Check `/api/errors` endpoint exists**: Create `MonitoringController` (see above)
2. **Check CORS**: Ensure your server allows POST to `/api/errors`
3. **Check browser console**: `DefaultClientErrorReporter` logs fetch errors

### Errors Reported Twice

This can happen if you manually catch and re-report errors. Solution:

```typescript
// ❌ Don't do this
try {
  await someFunction();
} catch (error) {
  this.errorReporter.reportError(error); // Reported here
  throw error; // AND reported by GlobalExceptionFilter
}

// ✅ Do this instead
try {
  await someFunction();
} catch (error) {
  // Add context, but don't report
  this.errorReporter.reportError(error, { customContext: true });
  throw error; // Only reported once (with enriched context)
}

// Or just let it bubble up:
await someFunction(); // Automatic reporting by GlobalExceptionFilter
```

## Migration Guide

### From Console Logging

**Before:**
```typescript
try {
  await render();
} catch (error) {
  console.error('Render error:', error);
  throw error;
}
```

**After:**
```typescript
// Just let it bubble up - automatic reporting!
await render();
```

### From Sentry Hardcoded

**Before:**
```typescript
import * as Sentry from '@sentry/node';

try {
  await render();
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

**After:**
```typescript
// 1. Create SentryErrorReporter (once)
// 2. Configure in AppModule.forRoot()
// 3. Remove all manual Sentry.captureException() calls
// 4. Let the framework handle it automatically
```

## Future Enhancements

Planned improvements for Phase 3+:

- [ ] **Error rate limiting** - Prevent flooding monitoring services
- [ ] **Error grouping** - Deduplicate similar errors
- [ ] **User feedback integration** - Capture user reports with error context
- [ ] **Performance monitoring** - Track slow endpoints/renders
- [ ] **Health checks** - `/health` endpoint with error statistics

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall framework architecture
- [BEST_PRACTICES.md](./BEST_PRACTICES.md) - SSR best practices
- [PRODUCTION_RISKS.md](./PRODUCTION_RISKS.md) - Production deployment checklist
