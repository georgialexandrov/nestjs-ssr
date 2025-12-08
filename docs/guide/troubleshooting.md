# Troubleshooting

Common issues and solutions when using NestJS SSR.

## Build & Module Issues

### Cannot find module errors

**Problem**: Import errors like `Cannot find module '@/views/home'` or `Module not found`.

**Solution 1 - Check Vite alias**:

```typescript
// vite.config.ts
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'), // Required for view auto-discovery
    },
  },
});
```

**Solution 2 - Check TypeScript paths**:

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

**Solution 3 - Verify file extensions**:
Use `.tsx` for React components, `.ts` for utilities. Import without extensions:

```typescript
import Home from '@/views/home'; // ✅ Correct
import Home from '@/views/home.tsx'; // ❌ Don't include extension
```

### Server bundle not found

**Problem**: Error `Server bundle not found in manifest` in production.

**Cause**: Missing server build output.

**Solution**:

```bash
# Build both client and server
pnpm build:client  # Creates dist/client/
pnpm build:server  # Creates dist/server/
pnpm build         # Or build NestJS app
```

Verify build output:

```
dist/
├── client/
│   ├── assets/
│   └── .vite/manifest.json
├── server/
│   └── entry-server.js
└── main.js
```

### Import.meta errors in production

**Problem**: `import.meta is not defined` or `import.meta.glob` errors.

**Cause**: Using Vite-specific APIs in server code.

**Solution**: Keep `import.meta.glob` in client entry only:

```typescript
// src/views/entry-client.tsx - ✅ Client-side only
const views = import.meta.glob('@/views/**/*.tsx');

// src/controllers/app.controller.ts - ❌ Don't use in server code
```

## Hydration Issues

### Hydration mismatch warnings

**Problem**: React warnings about server/client mismatch.

**Common causes**:

1. Using browser APIs during SSR
2. Random values (Math.random, Date.now)
3. Missing keys in lists
4. Conditional rendering based on browser state

**Solution 1 - Defer browser-specific code**:

```typescript
import { useEffect, useState } from 'react';

export default function MyComponent() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>Loading...</div>;  // SSR placeholder
  }

  // Browser-only code
  return <div>{window.innerWidth}px</div>;
}
```

**Solution 2 - Use suppressHydrationWarning**:

```typescript
export default function Clock() {
  return (
    <time suppressHydrationWarning>
      {new Date().toLocaleTimeString()}
    </time>
  );
}
```

**Solution 3 - Add keys to lists**:

```typescript
{items.map((item) => (
  <div key={item.id}>{item.name}</div>  // ✅ Unique key
))}
```

### Components not hydrating

**Problem**: Interactive features don't work after page load.

**Cause 1 - Missing client entry**:

Verify `src/views/entry-client.tsx` exists and hydrates:

```typescript
import { hydrateRoot } from 'react-dom/client';

const viewName = window.__COMPONENT_NAME__;
const views = import.meta.glob('@/views/**/*.tsx', { eager: true });

const Component = views[`/src/views/${viewName}.tsx`]?.default;
const props = window.__INITIAL_STATE__ || {};
const context = window.__CONTEXT__ || {};

hydrate Root(
  document.getElementById('root'),
  <Component data={props} context={context} />
);
```

**Cause 2 - Client scripts not loading**:

Check browser console for 404 errors. Verify static assets are served:

```typescript
// main.ts - Production only
if (process.env.NODE_ENV === 'production') {
  app.use('/assets', express.static('dist/client/assets'));
}
```

## SSR-Specific Issues

### Cannot access window/document

**Problem**: `ReferenceError: window is not defined` during SSR.

**Cause**: Using browser APIs in server-rendered code.

**Solution 1 - Check if running in browser**:

```typescript
const isBrowser = typeof window !== 'undefined';

export default function MyComponent() {
  const width = isBrowser ? window.innerWidth : 0;

  return <div>Width: {width || 'Server'}</div>;
}
```

**Solution 2 - Use useEffect for browser-only code**:

```typescript
import { useEffect } from 'react';

export default function MyComponent() {
  useEffect(() => {
    // Safe - only runs in browser
    localStorage.setItem('visited', 'true');
    window.gtag('event', 'page_view');
  }, []);

  return <div>Content</div>;
}
```

**Solution 3 - Lazy load browser-dependent components**:

```typescript
import { lazy, Suspense } from 'react';

const BrowserOnlyChart = lazy(() => import('./chart'));

export default function Dashboard() {
  return (
    <Suspense fallback={<div>Loading chart...</div>}>
      <BrowserOnlyChart />
    </Suspense>
  );
}
```

### localStorage/sessionStorage errors

**Problem**: `localStorage is not defined` during SSR.

**Solution - Create safe wrapper**:

```typescript
// utils/storage.ts
export const storage = {
  get(key: string): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  },

  set(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  },
};

// Usage
import { storage } from '@/utils/storage';

const theme = storage.get('theme') || 'light'; // ✅ Safe for SSR
```

### CSS not loading or flickering

**Problem**: Styles flash or don't load correctly.

**Cause 1 - Missing CSS imports in entry-server**:

Ensure CSS is imported server-side:

```typescript
// src/views/entry-server.tsx
import './globals.css'; // Import global styles
```

**Cause 2 - CSS-in-JS without SSR support**:

Use CSS-in-JS libraries with SSR support:

```typescript
// styled-components example
import { ServerStyleSheet } from 'styled-components';

// Emotion example
import createEmotionServer from '@emotion/server/create-instance';
```

**Cause 3 - Tailwind not processing**:

Verify Tailwind config includes server files:

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{ts,tsx}', // Include all source files
  ],
};
```

## Development Issues

### HMR not working

**Problem**: Changes don't reload in browser.

**Solution 1 - Check Vite is running**:

```bash
# Embedded mode (default) - no separate Vite server needed
pnpm dev

# Proxy mode - run Vite separately
pnpm vite  # Terminal 1
pnpm start:dev  # Terminal 2
```

**Solution 2 - Verify Vite middleware**:

```typescript
// main.ts
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
  });

  app.use(vite.middlewares); // Must come before routes
  renderService.setViteServer(vite);
}
```

**Solution 3 - Check for errors in console**:

HMR silently fails if there are syntax errors. Check both server and browser consoles.

### Port already in use

**Problem**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution 1 - Kill existing process**:

```bash
# Find process using port
lsof -ti:3000

# Kill it
lsof -ti:3000 | xargs kill
```

**Solution 2 - Use different port**:

```typescript
// main.ts
await app.listen(process.env.PORT || 3001);
```

**Solution 3 - Enable strict port in Vite**:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true, // Exit if port is taken
  },
});
```

### Slow development server

**Problem**: Vite dev server is slow or freezing.

**Solution 1 - Exclude node_modules**:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
});
```

**Solution 2 - Use proxy mode for large apps**:

```typescript
RenderModule.register({
  vite: { mode: 'proxy', port: 5173 },
});
```

**Solution 3 - Optimize dependencies**:

```typescript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    include: ['react', 'react-dom'], // Pre-bundle heavy deps
  },
});
```

## Production Issues

### Assets return 404

**Problem**: `/assets/index-abc123.js` returns 404 in production.

**Solution - Serve static assets**:

```typescript
// main.ts
import express from 'express';

if (process.env.NODE_ENV === 'production') {
  app.use(
    '/assets',
    express.static('dist/client/assets', {
      setHeaders: (res, path) => {
        // Cache hashed assets forever
        if (/\.[a-f0-9]{8,}\.(js|css)$/.test(path)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
}
```

### Memory leaks in production

**Problem**: Memory usage grows over time.

**Cause 1 - Event listeners not cleaned up**:

```typescript
useEffect(() => {
  const handler = () => console.log('resize');
  window.addEventListener('resize', handler);

  return () => window.removeEventListener('resize', handler); // ✅ Cleanup
}, []);
```

**Cause 2 - Timers not cleared**:

```typescript
useEffect(() => {
  const timer = setInterval(() => fetch('/api/status'), 5000);

  return () => clearInterval(timer); // ✅ Cleanup
}, []);
```

**Cause 3 - Circular references**:

Avoid storing components in state or passing functions with closures unnecessarily.

### Slow TTFB (Time to First Byte)

**Problem**: Pages take long to start loading.

**Solution 1 - Use streaming mode**:

```typescript
RenderModule.register({
  mode: 'stream', // Faster TTFB than 'string' mode
});
```

**Solution 2 - Move slow operations to client**:

```typescript
// ❌ Slow - blocks SSR
@Render(Dashboard)
async getDashboard() {
  const stats = await this.slowService.getStats();  // 2s delay
  return { stats };
}

// ✅ Fast - fetch client-side
@Render(Dashboard)
getDashboard() {
  return {};  // Render immediately, fetch in useEffect
}
```

**Solution 3 - Add caching**:

```typescript
@Injectable()
export class DashboardController {
  private cache = new Map();

  @Get()
  @Render(Dashboard)
  async getDashboard() {
    if (this.cache.has('stats')) {
      return { stats: this.cache.get('stats') };
    }

    const stats = await this.statsService.get();
    this.cache.set('stats', stats);
    return { stats };
  }
}
```

## Type Issues

### Props type not inferred

**Problem**: TypeScript doesn't infer component props from controller.

**Solution - Use PageProps generic**:

```typescript
import { PageProps } from '@nestjs-ssr/react';

interface HomeData {
  message: string;
  count: number;
}

export default function Home({ data }: PageProps<HomeData>) {
  return <h1>{data.message}</h1>;  // ✅ Fully typed
}
```

### RenderContext type mismatch

**Problem**: Custom context fields cause type errors.

**Solution - Extend the interface**:

```typescript
// types/render-context.d.ts
declare module '@nestjs-ssr/react' {
  interface RenderContext {
    user?: {
      id: string;
      name: string;
    };
  }
}
```

## Getting Help

Still stuck? Here's how to get help:

1. **Check the examples**: Browse `/examples` directory for working code
2. **Search issues**: Check [GitHub Issues](https://github.com/georgialexandrov/nestjs-ssr/issues)
3. **Enable debug logging**: Set `DEBUG=nestjs-ssr:*` environment variable
4. **Create minimal reproduction**: Isolate the issue in a small example
5. **Ask for help**: Create a new issue with:
   - Node/pnpm/React versions
   - Full error message and stack trace
   - Minimal code to reproduce
   - What you've already tried

## Next Steps

- [Performance Guide](/guide/performance) - Optimize your SSR app
- [Core Concepts](/guide/core-concepts) - Understand the architecture
- [API Reference](/reference/api) - Complete API documentation
