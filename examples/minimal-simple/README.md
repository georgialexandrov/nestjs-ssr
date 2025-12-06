# Minimal Simple NestJS SSR React Example

A minimal example demonstrating server-side rendering with NestJS and React using a **simple Vite middleware setup**. This approach prioritizes simplicity over hot module replacement.

## Features

- ✅ Server-Side Rendering (SSR) with React 19
- ✅ Full hydration support for interactive components
- ✅ TypeScript throughout
- ✅ Auto-generated view registry
- ✅ **Simple setup** - single server, no proxy configuration
- ✅ **Auto-restart on file changes** - page refreshes automatically

## When to Use This Setup

Choose this setup if:
- You're just getting started with NestJS SSR
- You prefer simplicity over hot module replacement
- Page refresh on changes is acceptable for your workflow
- You want minimal configuration

For hot module replacement (HMR), see the [`minimal`](../minimal) example.

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm start:dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## How It Works

This example uses **Vite in middleware mode** directly within NestJS:

```typescript
// src/main.ts
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'custom',
});

// Use Vite middleware to serve client-side assets
app.use(vite.middlewares);

// Set Vite instance for SSR
renderService.setViteServer(vite);
```

### Development Flow

1. Run `pnpm start:dev`
2. Access the app at `http://localhost:3000`
3. Edit a view file (e.g., `src/views/home.tsx`)
4. NestJS detects the change and restarts
5. Refresh the page to see your changes

**Note:** Unlike the [`minimal`](../minimal) example with HMR, this setup requires a manual page refresh to see changes. However, the setup is much simpler with no separate Vite server or proxy configuration.

## Project Structure

```
src/
├── view/                          # View layer (client + server entry points)
│   ├── entry-client.tsx          # Client-side hydration entry
│   ├── entry-server.tsx          # Server-side rendering entry
│   ├── template.html             # HTML template
│   └── view-registry.generated.ts # Auto-generated view registry
├── views/                         # React page components
│   └── home.tsx                  # Example page component
├── app.controller.ts             # NestJS controller
├── app.module.ts                 # NestJS root module
└── main.ts                       # NestJS bootstrap with Vite middleware
```

## View Registry

Views are automatically discovered and registered. Simply create a `.tsx` file in `src/views/`:

```tsx
// src/views/my-page.tsx
import type { PageProps } from '@nestjs-ssr/react';

export default function MyPage({ data }: PageProps<{ message: string }>) {
  return <div>{data.message}</div>;
}
```

Then render it from a controller:

```typescript
@ReactRender('views/my-page')
@Get('/my-page')
getMyPage() {
  return { message: 'Hello World' };
}
```

## Configuration

### TypeScript Configuration

**File:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "jsx": "react-jsx"
  }
}
```

Key settings:
- `module: "nodenext"` - Proper ESM/CJS interop for NestJS
- `jsx: "react-jsx"` - Modern JSX transform (no need to import React)

### NestJS CLI Configuration

**File:** `nest-cli.json`

```json
{
  "compilerOptions": {
    "deleteOutDir": false,
    "watchAssets": true
  }
}
```

- `deleteOutDir: false` - Prevents clearing Vite-built assets
- `watchAssets: true` - Enables asset watching in development

### Vite Configuration

**File:** `vite.config.js`

```javascript
export default defineConfig({
  plugins: [
    react(),
    viewRegistryPlugin(),  // Auto-generates view registry
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],  // Separate vendor bundle
        },
      },
    },
  },
});
```

Note: No server configuration needed since Vite runs in middleware mode only.

## Comparison with `minimal` Example

| Feature | minimal-simple (this) | minimal |
|---------|---------------------|---------|
| Setup complexity | Simple (~10 lines) | Complex (~40 lines) |
| Servers | 1 (NestJS only) | 2 (NestJS + Vite) |
| Hot Module Replacement | ❌ No | ✅ Yes |
| Page refresh on changes | ✅ Auto-restart + refresh | ✅ Instant HMR |
| Dependencies | Fewer | More (http-proxy-middleware, concurrently) |
| Configuration | Minimal | More complex |
| Best for | Getting started, simplicity | Advanced development, rapid iteration |

## Production Build

The production build creates optimized bundles:

```bash
# Build client and server bundles
pnpm build

# Output:
# dist/client/  - Static assets with content hashing
# dist/server/  - SSR bundle
# dist/        - Compiled NestJS application
```

Production features:
- Code splitting (React vendor chunk + app chunks)
- Content-hashed filenames for caching
- Minified JavaScript and CSS
- Manifest-based asset loading

## Common Issues

### "View not found in registry"

**Solution:**
1. Ensure the view file is in `src/**/views/*.tsx`
2. Check that the path matches: `@ReactRender('views/my-page')` for `src/views/my-page.tsx`
3. Restart the dev server to regenerate the registry

### Module Resolution Errors

**Solution:** Ensure `tsconfig.json` has `module: "nodenext"` and `moduleResolution: "nodenext"`.

## Upgrading to HMR

If you later want hot module replacement, see the [`minimal`](../minimal) example which demonstrates:
- Dual-server architecture (NestJS + Vite dev server)
- Proxy middleware for WebSocket HMR
- Instant hot reloading without page refresh

## Learn More

- [NestJS SSR React Documentation](../../packages/react/README.md)
- [NestJS Documentation](https://docs.nestjs.com)
- [Vite Documentation](https://vitejs.dev)
- [React Documentation](https://react.dev)
