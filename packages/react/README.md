# @nestjs-ssr/react

Elegant React SSR for NestJS. Zero-config, fully typed, production-ready.

Following the [UnJS philosophy](https://unjs.io/): unintrusive, minimal, framework-agnostic.

## Features

✅ **Zero Configuration** - Works out of the box with sensible defaults
✅ **TypeScript First** - Fully typed with excellent IDE support
✅ **Streaming SSR** - Modern streaming renderToReadableStream support
✅ **HMR in Development** - Powered by Vite for instant feedback
✅ **Production Optimized** - Code splitting, compression, and caching
✅ **Extensible** - Customize everything via configuration
✅ **Framework Agnostic** - Use with any NestJS setup

## Quick Start

### Installation

```bash
npm install @nestjs-ssr/react react react-dom vite
```

### 1. Configure Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viewRegistryPlugin } from '@nestjs-ssr/react/vite';

export default defineConfig({
  plugins: [react(), viewRegistryPlugin()],
});
```

### 2. Setup NestJS Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { RenderModule } from '@nestjs-ssr/react';

@Module({
  imports: [
    RenderModule.register(), // Zero config!
  ],
})
export class AppModule {}
```

### 3. Create a View

```typescript
// src/views/home.tsx
import type { PageProps } from '@nestjs-ssr/react';

interface HomeData {
  message: string;
}

export default function Home({ data }: PageProps<HomeData>) {
  return <h1>{data.message}</h1>;
}
```

### 4. Create a Controller

```typescript
// app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ReactRender } from '@nestjs-ssr/react';

@Controller()
export class AppController {
  @Get()
  @ReactRender('views/home')
  getHome() {
    return { message: 'Hello from NestJS SSR!' };
  }
}
```

### 5. Add Entry Files

Create these files in `src/view/`:

**entry-client.tsx**:
```typescript
import { hydrateRoot } from 'react-dom/client';
import { AppWrapper } from '@nestjs-ssr/react';
import { viewRegistry } from './view-registry.generated';

hydrateRoot(
  document.getElementById('root')!,
  <AppWrapper
    viewRegistry={viewRegistry}
    initialProps={window.__INITIAL_PROPS__}
    initialContext={window.__RENDER_CONTEXT__}
  />
);
```

**entry-server.tsx**:
```typescript
import { AppWrapper } from '@nestjs-ssr/react';
import { viewRegistry } from './view-registry.generated';

export function render(viewPath: string, props: any, context: any) {
  return (
    <AppWrapper
      viewRegistry={viewRegistry}
      viewPath={viewPath}
      initialProps={props}
      initialContext={context}
    />
  );
}
```

### 6. Run

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) 🎉

## Core Concepts

### The `@ReactRender` Decorator

The decorator intercepts your controller's response and renders it with React:

```typescript
@Get('/users/:id')
@ReactRender('users/views/user-profile')
async getUser(@Param('id') id: string) {
  const user = await this.userService.findOne(id);
  return { user }; // Passed as `data` prop to component
}
```

### Type-Safe Props

Components receive props with full TypeScript support:

```typescript
import type { PageProps, RenderContext } from '@nestjs-ssr/react';

interface UserData {
  user: User;
}

export default function UserProfile({ data, context }: PageProps<UserData>) {
  return (
    <div>
      <h1>{data.user.name}</h1>
      <p>Requested from: {context.path}</p>
    </div>
  );
}
```

### Request Context

Every component receives the request context:

```typescript
interface RenderContext {
  url: string;
  path: string;
  query: Record<string, any>;
  params: Record<string, string>;
  userAgent?: string;
  acceptLanguage?: string;
  referer?: string;
}
```

You can extend it with custom data using TypeScript declaration merging!

### React Hooks

Access context in any component:

```typescript
import { usePageContext, useParams, useQuery } from '@nestjs-ssr/react';

function MyComponent() {
  const context = usePageContext();
  const params = useParams();
  const query = useQuery();

  return <div>User ID: {params.id}</div>;
}
```

## Configuration

### SSR Modes

Choose between string mode (simple) or stream mode (faster):

```typescript
RenderModule.register({
  mode: 'stream', // or 'string' (default)
})
```

### Custom Error Pages

```typescript
import { ErrorPageCustom } from './error-page';

RenderModule.register({
  errorPageDevelopment: ErrorPageCustom,
  errorPageProduction: ErrorPageCustom,
})
```

### Environment Variables

```bash
SSR_MODE=stream          # 'string' or 'stream'
NODE_ENV=production      # Enables production optimizations
```

## Advanced Features

### Error Monitoring (Optional)

```typescript
import { MonitoringModule, type ErrorReporter } from '@nestjs-ssr/react';

class SentryReporter implements ErrorReporter {
  report(error: Error, context: ErrorContext) {
    Sentry.captureException(error, { extra: context });
  }
}

@Module({
  imports: [
    MonitoringModule.forRoot({
      errorReporter: new SentryReporter(),
    }),
  ],
})
```

### Extending Context

Add custom data to the render context:

```typescript
// types/render-context.d.ts
declare module '@nestjs-ssr/react' {
  interface RenderContext {
    user?: User;
    tenant?: string;
  }
}
```

Then inject it in a custom interceptor.

## Examples

- **[Minimal Example](../../examples/minimal/)** - Bare-bones quick start
- **[Full-Featured Example](../../examples/full-featured/)** - Real-world patterns

## Documentation

- [Getting Started](../../docs/getting-started.md)
- [Why NestJS SSR?](../../docs/why-nestjs-ssr.md)
- [Architecture](../../docs/ARCHITECTURE.md)
- [Testing Guide](../../docs/TESTING_STRATEGY.md)
- [Production Deployment](../../docs/PRODUCTION_RISKS.md)

## Philosophy

This package follows the UnJS philosophy:

1. **Unintrusive** - Integrates seamlessly with existing NestJS apps
2. **Zero-Config** - Works out of the box with sensible defaults
3. **Fully Extensible** - Customize everything when needed
4. **Framework Agnostic** - No opinions on routing, state, or business logic
5. **TypeScript First** - Excellent type safety and IDE support

## Requirements

- Node.js 18+
- NestJS 11+
- React 19+
- Vite 6+
- TypeScript 5+

## License

MIT © Georgi Alexandrov

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Support

- [GitHub Issues](https://github.com/yourusername/nestjs-ssr/issues)
- [Documentation](../../docs/)
- [Examples](../../examples/)
