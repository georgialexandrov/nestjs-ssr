# @nestjs-ssr/react

**React SSR for NestJS that respects Clean Architecture.**

A lightweight, production-ready library that brings React to NestJS while preserving the architectural principles that make NestJS great: **Dependency Injection**, **SOLID principles**, and **clear separation of concerns**.

## Why This Library?

### Built for Clean Architecture

If you value [Uncle Bob's Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) and software craftsmanship, you'll appreciate how this library maintains architectural boundaries:

**Clear Separation of Concerns:**
```typescript
// Server logic stays in controllers (Application Layer)
@Controller()
export class UserController {
  constructor(private userService: UserService) {}  // Proper DI

  @Get('/users/:id')
  @Render('views/user-profile')
  async getUserProfile(@Param('id') id: string) {
    const user = await this.userService.findById(id);  // Business logic
    return { user };  // Pure data - no rendering concerns
  }
}

// View logic stays in React components (Presentation Layer)
export default function UserProfile({ data }: PageProps<{ user: User }>) {
  return <div>{data.user.name}</div>;  // Pure presentation
}
```

**No Server/Client Confusion:**
- Server code is server code (Controllers, Services, Guards)
- Client code is client code (React components, hooks)
- No `'use server'` / `'use client'` directives scattered throughout
- No mixing of database queries with JSX
- No hidden boundaries where code "magically" switches execution context

**True Dependency Injection:**
```typescript
// Use NestJS DI throughout your application
@Injectable()
export class ProductService {
  constructor(
    private db: DatabaseService,
    private cache: CacheService,
  ) {}
}

// Testable, mockable, follows IoC principle
```

### Why Not Next.js?

Next.js is excellent for many use cases, but if you care about architectural integrity:

**Next.js encourages coupling:**
```tsx
// ❌ Server and client code mixed in the same file
export default function Page() {
  const data = await fetch('...').then(r => r.json());  // Server
  const [count, setCount] = useState(0);                 // Client
  return <button onClick={() => setCount(count + 1)}>{data.title}</button>;
}
```
- Server and client logic intertwined
- No dependency injection - just imports and function calls
- Difficult to test business logic in isolation
- Routes are files, not proper routing with guards/interceptors
- Framework-specific patterns instead of universal principles

**NestJS SSR maintains boundaries:**
```tsx
// ✅ Controller: Server-only, testable, uses DI
@Controller()
export class ProductController {
  constructor(private productService: ProductService) {}

  @Get('/products')
  @UseGuards(AuthGuard)  // Proper middleware
  @Render('views/products')
  async list() {
    return { products: await this.productService.findAll() };
  }
}

// ✅ View: Client-only, pure presentation
export default function Products({ data }: PageProps) {
  const [selected, setSelected] = useState(null);
  return <ProductList products={data.products} onSelect={setSelected} />;
}
```

### Performance as a Bonus

Following clean architecture doesn't mean sacrificing performance. In our benchmarks:

- **NestJS SSR:** 3,050 req/sec (32ms latency)
- **Next.js:** 2,965 req/sec (33ms latency)
- **Remix:** 915 req/sec (109ms latency)

**Equal performance** with **better architecture.**

## Features

✅ **Architectural Integrity** - Respects SOLID and Clean Architecture principles
✅ **Dependency Injection** - Full NestJS DI throughout your application
✅ **Clear Boundaries** - Server code is server, client code is client
✅ **Zero Configuration** - Works out of the box with sensible defaults
✅ **TypeScript First** - Fully typed with excellent IDE support
✅ **Streaming SSR** - Modern renderToPipeableStream support
✅ **HMR in Development** - Powered by Vite for instant feedback
✅ **Production Optimized** - Code splitting, compression, and caching
✅ **Testable** - Easy to unit test controllers and services separately

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
import { Render } from '@nestjs-ssr/react';

@Controller()
export class AppController {
  @Get()
  @Render('views/home')
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

### The `@Render` Decorator

The decorator intercepts your controller's response and renders it with React:

```typescript
@Get('/users/:id')
@Render('users/views/user-profile')
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

### Vite Development Setup

You have two options for integrating Vite during development:

#### Option 1: Simple Setup (Recommended for Getting Started)

Use Vite in middleware mode directly within NestJS. This approach is simpler but requires manual page refresh to see changes.

```typescript
// main.ts
import { createServer as createViteServer } from 'vite';
import { RenderService } from '@nestjs-ssr/react';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const renderService = app.get(RenderService);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);
    renderService.setViteServer(vite);
  }

  await app.listen(3000);
}
```

**Pros:**
- Simple setup (~10 lines of code)
- Single server on port 3000
- Auto-restart on file changes

**Cons:**
- Requires manual page refresh to see changes
- No hot module replacement (HMR)

See [`minimal-simple`](../../examples/minimal-simple) example.

#### Option 2: Full HMR Setup (Best Developer Experience)

Run a separate Vite dev server with proxy middleware for instant hot reloading.

```typescript
// main.ts
import { createServer as createViteServer } from 'vite';
import { RenderService } from '@nestjs-ssr/react';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const renderService = app.get(RenderService);

  if (process.env.NODE_ENV !== 'production') {
    // Proxy to external Vite server for HMR
    const { createProxyMiddleware } = await import('http-proxy-middleware');
    const viteProxy = createProxyMiddleware({
      target: 'http://localhost:5173',
      changeOrigin: true,
      ws: true,
      pathFilter: (pathname: string) => {
        return (
          pathname.startsWith('/src/') ||
          pathname.startsWith('/@') ||
          pathname.startsWith('/node_modules/')
        );
      },
    });
    app.use(viteProxy);

    // Vite instance for SSR
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    renderService.setViteServer(vite);
  }

  await app.listen(3000);
}
```

**Additional dependencies:**
```bash
npm install -D http-proxy-middleware concurrently
```

**package.json scripts:**
```json
{
  "scripts": {
    "start:dev": "concurrently \"vite --port 5173\" \"nest start --watch\""
  }
}
```

**vite.config.js:**
```javascript
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },  // Critical for HMR
  },
});
```

**Pros:**
- Instant hot module replacement (HMR)
- Best developer experience for rapid iteration
- No page refresh needed

**Cons:**
- More complex setup (~40 lines)
- Requires two servers (NestJS + Vite)
- Additional dependencies

See [`minimal`](../../examples/minimal) example.

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

Choose the example that matches your needs:

- **[Minimal Simple](../../examples/minimal-simple/)** - Simplest setup with Vite middleware (no HMR)
  - Perfect for getting started quickly
  - Single server, minimal configuration

- **[Minimal](../../examples/minimal/)** - Full HMR setup with dual-server architecture
  - Best developer experience with instant hot reloading
  - Recommended for active development

- **[Full-Featured](../../examples/full-featured/)** - Production-ready example
  - Security headers, caching, error handling
  - Streaming SSR with React Suspense

## Documentation

- [Getting Started](../../docs/getting-started.md)
- [Why NestJS SSR?](../../docs/why-nestjs-ssr.md)
- [Architecture](../../docs/ARCHITECTURE.md)
- [Testing Guide](../../docs/TESTING_STRATEGY.md)
- [Production Deployment](../../docs/PRODUCTION_RISKS.md)

## Philosophy

This package is built on two foundational principles:

### Clean Architecture & SOLID Principles

Following [Uncle Bob's Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) and software craftsmanship principles:

**Single Responsibility Principle (SRP):**
- Controllers handle HTTP routing and orchestration
- Services contain business logic
- Views handle presentation
- Each has one reason to change

**Dependency Inversion Principle (DIP):**
- Controllers depend on service abstractions (interfaces)
- Services are injected via NestJS DI
- Views receive data as props (dependency injection via props)
- No concrete dependencies on frameworks in your business logic

**Interface Segregation & Open/Closed:**
- Use NestJS Guards for authentication/authorization
- Use Interceptors for cross-cutting concerns
- Views are pure functions - open for extension, closed for modification

**Clear Architectural Boundaries:**
```
┌─────────────────────────────────────────┐
│  Presentation Layer (React Components)  │
│  - Pure presentation logic              │
│  - Client-side interactivity            │
│  - No business logic                    │
└─────────────────────────────────────────┘
              ↓ Props (Data Flow)
┌─────────────────────────────────────────┐
│  Application Layer (Controllers)        │
│  - Request handling                     │
│  - Orchestration                        │
│  - DTO validation                       │
└─────────────────────────────────────────┘
              ↓ DI (Dependency Injection)
┌─────────────────────────────────────────┐
│  Domain Layer (Services)                │
│  - Business logic                       │
│  - Domain models                        │
│  - Use cases                            │
└─────────────────────────────────────────┘
```

### UnJS Philosophy

Following the [UnJS philosophy](https://unjs.io/) for modern JavaScript libraries:

1. **Unintrusive** - Integrates seamlessly with existing NestJS apps
2. **Zero-Config** - Works out of the box with sensible defaults
3. **Fully Extensible** - Customize everything when needed
4. **Framework Agnostic** - No opinions on routing, state, or business logic
5. **TypeScript First** - Excellent type safety and IDE support

**The Result:** Clean, maintainable, testable code that scales with your team and product.

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
