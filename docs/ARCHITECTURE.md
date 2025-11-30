# Architecture Documentation

## Overview

This document describes the current architecture of the NestJS + React SSR framework. The design follows NestJS conventions while integrating React as a view layer with server-side rendering and client-side hydration.

---

## Core Principles

1. **Module-Based Architecture** - Each NestJS module owns its views (Clean Architecture / Domain-Driven Design)
2. **Convention Over Configuration** - Minimal setup, maximum developer happiness
3. **Type Safety** - Full TypeScript support from server to client
4. **Hot Module Replacement** - Fast development iteration
5. **Framework Agnostic Core** - Inspired by UnJS, designed to work across platforms

---

## File Structure

```
nest-ssr/
├── src/
│   ├── view/                          # Client infrastructure
│   │   ├── entry-client.tsx           # Hydration entry point
│   │   ├── entry-server.tsx           # SSR rendering logic
│   │   ├── app.tsx                    # Root React app wrapper
│   │   └── template.html              # HTML template
│   │
│   ├── app/                           # Root application module
│   │   ├── app.controller.ts          # Root controller
│   │   ├── app.service.ts             # Root service
│   │   ├── app.module.ts              # Root module
│   │   └── views/                     # App-level views
│   │       └── home.tsx               # Home page component
│   │
│   ├── users/                         # Example domain module
│   │   ├── users.controller.ts        # NestJS controller
│   │   ├── users.service.ts           # Business logic
│   │   ├── users.module.ts            # Module definition
│   │   └── views/                     # React views (kebab-case)
│   │       ├── user-list.tsx          # /users route
│   │       └── user-profile.tsx       # /users/:id route
│   │
│   ├── shared/                        # Shared/common code
│   │   ├── render/                    # Render infrastructure
│   │   │   ├── render.service.ts      # SSR service
│   │   │   ├── render.module.ts       # Global render module
│   │   │   ├── render.interceptor.ts  # Intercepts @ReactRender
│   │   │   ├── decorators/
│   │   │   │   └── react-render.decorator.ts
│   │   │   └── interfaces/
│   │   │       ├── render-context.interface.ts
│   │   │       └── page-props.interface.ts
│   │   └── views/                     # Shared React components
│   │       ├── layout.tsx
│   │       ├── button.tsx
│   │       └── counter.tsx
│   │
│   └── main.ts                        # NestJS bootstrap + Vite
│
├── vite.config.ts                     # Vite configuration
├── tsconfig.json                      # TypeScript configuration
└── package.json                       # Dependencies and scripts
```

---

## Data Flow

### SSR Request Flow

```
1. HTTP GET /users
   │
   ↓
2. NestJS Router → UsersController.list()
   │
   ↓
3. @ReactRender('users/views/user-list') decorator
   │
   ↓
4. RenderInterceptor intercepts response
   │
   ├─→ Extracts data from controller
   ├─→ Builds RenderContext (params, query, headers)
   └─→ Calls RenderService.render(viewPath, data)
   │
   ↓
5. RenderService
   │
   ├─→ Loads component from view registry
   ├─→ Calls entry-server.tsx:renderComponent()
   └─→ React.renderToString(<UserList {...props} />)
   │
   ↓
6. HTML Template
   │
   ├─→ Injects SSR HTML into <div id="root">
   ├─→ Serializes data to window.__INITIAL_STATE__
   ├─→ Serializes context to window.__COMPONENT_PATH__
   └─→ Injects <script src="/src/view/entry-client.tsx">
   │
   ↓
7. Response sent to browser
```

### Client Hydration Flow

```
1. Browser receives HTML
   │
   ├─→ Sees SSR content immediately (fast FCP)
   └─→ Downloads /src/view/entry-client.tsx
   │
   ↓
2. entry-client.tsx executes
   │
   ├─→ Reads window.__INITIAL_STATE__
   ├─→ Reads window.__COMPONENT_PATH__
   └─→ Looks up component in view registry
   │
   ↓
3. React hydration
   │
   └─→ hydrateRoot(<UserList {...initialState} />)
   │
   ↓
4. Page becomes interactive
   │
   └─→ Event listeners attached
   └─→ State initialized
   └─→ React takes over
```

---

## Key Components

### 1. View Registry

**Location:** `src/view/entry-server.tsx` and `src/view/entry-client.tsx`

**Current Implementation:**
```typescript
// Static imports of all view components
import HomeView from '../app/views/home.js';
import UserListView from '../users/views/user-list.js';
import UserProfileView from '../users/views/user-profile.js';

// Map view path to component
const viewRegistry: Record<string, React.ComponentType<any>> = {
  'app/views/home': HomeView,
  'users/views/user-list': UserListView,
  'users/views/user-profile': UserProfileView,
};
```

**Purpose:**
- Maps string paths to React components
- Same registry used on server (SSR) and client (hydration)
- Ensures consistency between server and client rendering

**Limitation:**
- **Manual maintenance required** - Adding a new view requires editing BOTH files
- **Scalability issue** - Doesn't scale beyond ~10-20 components
- **Future improvement:** Auto-generation (Phase 3.1 in roadmap)

---

### 2. @ReactRender Decorator

**Location:** `src/shared/render/decorators/react-render.decorator.ts`

**Usage:**
```typescript
@Controller('users')
export class UsersController {
  @Get()
  @ReactRender('users/views/user-list')
  list() {
    return { users: this.usersService.findAll() }
  }
}
```

**How it works:**
1. Stores view path in metadata using `SetMetadata`
2. RenderInterceptor reads this metadata
3. Calls RenderService with the view path and controller return value

**Metadata key:**
```typescript
export const REACT_RENDER_KEY = 'reactRender';
```

---

### 3. RenderInterceptor

**Location:** `src/shared/render/render.interceptor.ts`

**Responsibilities:**
1. Intercepts controller method execution
2. Checks for `@ReactRender` metadata
3. Extracts return value from controller
4. Builds RenderContext from request
5. Calls RenderService to generate HTML
6. Sends HTML response

**Implementation:**
```typescript
@Injectable()
export class RenderInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const viewPath = this.reflector.get<string>(
      REACT_RENDER_KEY,
      context.getHandler(),
    );

    if (!viewPath) {
      return next.handle(); // No decorator, proceed normally
    }

    return next.handle().pipe(
      switchMap(async (data) => {
        const response = context.switchToHttp().getResponse<Response>();
        const html = await this.renderService.render(viewPath, data);
        response.type('text/html');
        return html; // Let NestJS handle sending the response
      }),
    );
  }
}
```

---

### 4. RenderService

**Location:** `src/shared/render/render.service.ts`

**Responsibilities:**
1. Manages Vite dev server (development mode)
2. Loads HTML template
3. Calls entry-server.tsx to render React component
4. Serializes data to JavaScript
5. Injects HTML, scripts, and data into template
6. Returns complete HTML

**Key methods:**
```typescript
class RenderService {
  setViteServer(vite: ViteDevServer): void
  async render(viewPath: string, data: any): Promise<string>
}
```

**Development vs Production:**
```typescript
if (this.vite) {
  // Development: Use Vite's SSR module loading
  renderModule = await this.vite.ssrLoadModule('/src/view/entry-server.tsx');
} else {
  // Production: Load pre-built server bundle with manifest-based asset resolution
  renderModule = await import('../../dist/server/entry-server.js');
}
```

---

### 5. Entry Server

**Location:** `src/view/entry-server.tsx`

**Purpose:**
Server-side rendering entry point that React components to HTML strings.

**Exports:**
```typescript
export async function renderComponent(
  componentPath: string,
  props: any,
): Promise<string>
```

**Implementation:**
```typescript
export async function renderComponent(componentPath: string, props: any) {
  const Component = viewRegistry[componentPath];

  if (!Component) {
    throw new Error(`Component not found: ${componentPath}`);
  }

  const html = renderToString(
    <App>
      <Component {...props} />
    </App>
  );

  return html;
}
```

---

### 6. Entry Client

**Location:** `src/view/entry-client.tsx`

**Purpose:**
Client-side hydration entry point that "wakes up" the SSR HTML.

**Flow:**
```typescript
1. Read window.__INITIAL_STATE__
2. Read window.__COMPONENT_PATH__
3. Look up component in viewRegistry
4. Call hydrateRoot() with same component + props as server
5. React attaches event listeners to existing DOM
```

**Implementation:**
```typescript
function hydrate() {
  const initialState = window.__INITIAL_STATE__ || {};
  const componentPath = window.__COMPONENT_PATH__;

  const Component = viewRegistry[componentPath];

  hydrateRoot(
    document.getElementById('root'),
    <App>
      <Component {...initialState} />
    </App>
  );
}
```

---

## Module Communication

### How Modules Interact

```
AppModule (root)
  │
  ├─→ imports RenderModule (global)
  │     │
  │     └─→ provides RenderService
  │     └─→ provides RenderInterceptor (APP_INTERCEPTOR)
  │
  └─→ imports UsersModule
        │
        ├─→ UsersController uses @ReactRender
        │     │
        │     └─→ RenderInterceptor catches it
        │           │
        │           └─→ RenderService renders view
        │
        └─→ views/user-list.tsx
              │
              └─→ Can import from @shared/views
```

**Global Module Pattern:**
```typescript
@Global()
@Module({
  providers: [
    RenderService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RenderInterceptor,
    },
  ],
  exports: [RenderService],
})
export class RenderModule {}
```

- `@Global()` makes RenderService available everywhere
- `APP_INTERCEPTOR` applies RenderInterceptor to all routes
- No need to import RenderModule in every feature module

---

## Vite Integration

### Development Mode

**Bootstrap (main.ts):**
```typescript
import { createServer as createViteServer } from 'vite';

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'custom',
});

app.use(vite.middlewares); // Before NestJS routes
```

**Benefits:**
- HMR for React components (instant updates)
- On-demand compilation (fast startup)
- Source maps for debugging
- Transform TypeScript/JSX on the fly

**Middleware Order:**
```
Request
  ↓
1. Vite middleware (serves /src/**, handles HMR)
  ↓
2. NestJS routes (controllers)
  ↓
Response
```

### Production Mode ✅ Implemented

```typescript
const isDevelopment = process.env.NODE_ENV !== 'production';

if (isDevelopment) {
  // Development: Use Vite dev server for HMR
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  renderService.setViteServer(vite);
  app.use(vite.middlewares);
} else {
  // Production: Serve static files with cache headers
  app.use(
    '/assets',
    express.static('dist/client/assets', {
      setHeaders: (res: Response, path: string) => {
        const hasHash = /\.[a-f0-9]{8,}\.(js|css)/.test(path);
        if (hasHash) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
        }
      },
    }),
  );
}
```

---

## TypeScript Configuration

### Path Aliases

```json
{
  "compilerOptions": {
    "paths": {
      "@view/*": ["src/view/*"],
      "@shared/*": ["src/shared/*"],
      "@users/*": ["src/users/*"]
    }
  }
}
```

**Benefits:**
- Clean imports: `import { Layout } from '@shared/views/layout'`
- Refactor-safe: Moving files doesn't break imports
- IDE autocomplete

### JSX Configuration

```json
{
  "compilerOptions": {
    "jsx": "react-jsx"  // Modern JSX transform (no React import needed)
  }
}
```

---

## Naming Conventions

### Files
- **React components:** kebab-case (e.g., `user-list.tsx`, `user-profile.tsx`)
- **NestJS files:** kebab-case with suffix (e.g., `users.controller.ts`, `users.service.ts`)
- **Shared components:** kebab-case (e.g., `button.tsx`, `counter.tsx`)

### Folders
- **Module folders:** kebab-case (e.g., `users/`, `products/`)
- **View directories:** always named `views/`
- **Infrastructure:** descriptive (e.g., `render/`, `monitoring/`)

### View Paths
- Format: `{module}/views/{component-name}`
- Examples:
  - `app/views/home`
  - `users/views/user-list`
  - `users/views/user-profile`

---

## Design Patterns

### 1. Interceptor Pattern
**NestJS pattern for cross-cutting concerns**
- Renders React components without polluting controllers
- Similar to Express middleware but more powerful
- Can transform responses

### 2. Registry Pattern
**Maps strings to components**
- Enables dynamic component loading
- Type-safe with TypeScript
- Will be auto-generated in future

### 3. Provider Pattern (React Context)
**Future: Request context available to all components**
```typescript
<PageContextProvider context={renderContext}>
  <UserList />
</PageContextProvider>
```

### 4. Module Pattern (NestJS)
**Each domain module owns its views**
- Cohesive: related code stays together
- Clean Architecture: views are part of presentation layer
- Easy to understand and maintain

---

## Request/Response Cycle

### Example: Rendering /users/123

```typescript
// 1. HTTP Request
GET /users/123

// 2. NestJS Router matches route
@Get(':id')

// 3. Controller executes
async profile(@Param('id') id: string) {
  const user = await this.usersService.findOne(parseInt(id, 10));
  return { user }; // { user: { id: 123, name: 'John' } }
}

// 4. Interceptor catches response
viewPath = 'users/views/user-profile'
data = { user: { id: 123, name: 'John' } }

// 5. RenderService calls entry-server
const html = await renderComponent(
  'users/views/user-profile',
  { user: { id: 123, name: 'John' } }
);

// 6. React renders
<UserProfile user={{ id: 123, name: 'John' }} />

// 7. HTML template
<!DOCTYPE html>
<html>
  <head>...</head>
  <body>
    <div id="root">
      <!-- SSR HTML here -->
      <div><h1>John</h1>...</div>
    </div>
    <script>
      window.__INITIAL_STATE__ = {"user":{"id":123,"name":"John"}};
      window.__COMPONENT_PATH__ = "users/views/user-profile";
    </script>
    <script type="module" src="/src/view/entry-client.tsx"></script>
  </body>
</html>

// 8. Client hydrates
hydrateRoot(root, <UserProfile user={{ id: 123, name: 'John' }} />)

// 9. Page becomes interactive
```

---

## Performance Characteristics

### Development Mode
- **Cold start:** 2-3 seconds (Vite + NestJS initialization)
- **Hot reload:** <100ms (Vite HMR)
- **SSR time:** 5-20ms per request
- **Memory:** ~200MB (Vite dev server)

### Production Mode ✅ Measured
- **Cold start:** ~1 second (pre-built assets)
- **SSR time:** 5-20ms per request (pre-compiled)
- **Bundle size:** Client ~202KB, Server ~21KB (with content hashing)
- **Memory:** <100MB per instance
- **TTFB:** ~50-200ms

---

## Security Considerations

### What's Safe to Expose

✅ **Safe:**
- Route parameters (already in URL)
- Query parameters (already in URL)
- Data explicitly returned by controller

❌ **Never expose:**
- Raw cookies
- Authorization headers
- Internal headers (X-Forwarded-For, etc.)
- Database credentials
- API keys

### Serialization Safety

```typescript
import serialize from 'serialize-javascript';

// ✅ Safe: Uses serialize-javascript (XSS protection)
window.__INITIAL_STATE__ = ${serialize(data, { isJSON: true })};

// ❌ Unsafe: Direct JSON.stringify (XSS vulnerability)
window.__INITIAL_STATE__ = ${JSON.stringify(data)};
```

---

## Future Architecture Changes

### Auto-Generated View Registry (Phase 3.1)
```typescript
// BEFORE: Manual (current)
import UserList from '../users/views/user-list.js';
const viewRegistry = { 'users/views/user-list': UserList };

// AFTER: Auto-generated
import { viewRegistry } from './generated-view-registry';
// Registry auto-updates when files change
```

### Streaming SSR (Phase 3.3)
```typescript
// BEFORE: renderToString (blocking)
const html = renderToString(<App />);

// AFTER: renderToPipeableStream (streaming)
const { pipe } = renderToPipeableStream(<App />, {
  onShellReady() { pipe(response); }
});
```

### Production Build System ✅ Complete (Phase 2.2)
```
Development:
  Request → Vite transform → NestJS → React SSR → Response

Production:
  Request → NestJS → React SSR (pre-built) → Response
  Static assets served from dist/client/assets with cache headers

Build Process:
  1. pnpm build:client → dist/client/ (Vite client bundle + manifest)
  2. pnpm build:server → dist/server/ (Vite SSR bundle + manifest)
  3. nest build → dist/src/ (NestJS application)
  4. pnpm start:prod → Production server with pre-built assets
```

---

## Comparison to Other Frameworks

| Feature | This Framework | Next.js | Remix | Nuxt |
|---------|---------------|---------|-------|------|
| Server Framework | NestJS | Next.js API | Express/etc | Nitro |
| View Framework | React | React | React | Vue |
| Routing | NestJS decorators | File-based | File-based | File-based |
| Data Fetching | Controller return | getServerSideProps | loader functions | useAsyncData |
| Module System | NestJS modules | Pages | Routes | Nuxt modules |
| Architecture | Domain-driven | Page-based | Route-based | Page-based |

**Unique strengths:**
- Uses existing NestJS architecture (controllers, services, modules)
- Domain-driven design (views belong to modules)
- Leverages NestJS DI container
- Full control over server framework
- Can integrate with existing NestJS apps

---

## Troubleshooting Common Issues

### Hydration Mismatches
**Symptom:** React warning in console, content flashes

**Causes:**
- Date/time formatting (server vs client timezone)
- Random data (Math.random(), Date.now())
- Browser-specific code in SSR

**Solution:**
- Use stable data sources
- Wrap browser-only code in useEffect
- Ensure server and client render identically

### View Not Found
**Symptom:** `Component not found at path: X`

**Causes:**
- Typo in `@ReactRender('path')`
- Component not registered in view registry

**Solution:**
- Check spelling of view path
- Add component to both entry-server and entry-client registries

### HMR Not Working
**Symptom:** Changes require manual refresh

**Causes:**
- Vite middleware not registered
- File outside Vite watch scope

**Solution:**
- Ensure `app.use(vite.middlewares)` is before NestJS routes
- Check file is in `src/` directory

---

## Testing Strategy (Future)

### Unit Tests
- React components (Jest + React Testing Library)
- NestJS services (Jest)
- Utilities and helpers

### Integration Tests
- Controller → View rendering (e2e)
- Hydration correctness
- Data serialization

### E2E Tests
- Full user flows (Playwright)
- SSR + hydration + interaction
- Performance benchmarks

---

## Contributing Guidelines (Future)

When adding features, maintain these principles:
1. **Module cohesion** - Views belong to their domain module
2. **Type safety** - No `any` types in public APIs
3. **Convention over configuration** - Minimize boilerplate
4. **Developer experience** - Fast, intuitive, minimal magic
5. **Clean Architecture** - Clear separation of concerns
