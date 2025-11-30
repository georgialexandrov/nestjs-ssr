# Minimal NestJS SSR React Example

A minimal example demonstrating server-side rendering with NestJS and React, featuring hot module replacement (HMR) during development.

## Features

- ✅ Server-Side Rendering (SSR) with React 19
- ✅ Full hydration support for interactive components
- ✅ Hot Module Replacement (HMR) with Vite
- ✅ TypeScript throughout
- ✅ Auto-generated view registry

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm start:dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Development Architecture

This example uses a **dual-server architecture** for optimal developer experience:

### Vite Dev Server (Port 5173)
- Handles client-side HMR
- Provides fast module transformation
- Serves static assets in development

### NestJS Server (Port 3000)
- Handles SSR rendering
- Serves API endpoints
- Proxies client requests to Vite

### How It Works

1. You access the app at `http://localhost:3000`
2. NestJS renders the initial HTML on the server
3. The HTML includes a Vite client script that connects to `ws://localhost:5173` for HMR
4. When you edit view files:
   - Vite detects the change and sends HMR updates via WebSocket
   - NestJS restarts to load the new server-side code
   - **The Vite WebSocket remains connected**, so HMR continues working

## Critical Configuration

### HMR Port Configuration

**File:** `vite.config.js`

```javascript
export default defineConfig({
  server: {
    port: 5173,
    hmr: {
      port: 5173,  // CRITICAL: Must match Vite server port
    },
  },
});
```

⚠️ **Why this is critical:**
- Without `hmr.port`, the Vite client tries to connect to the same port as the page (3000)
- When NestJS restarts, the WebSocket connection is lost
- HMR stops working until you manually refresh

With `hmr.port: 5173`:
- The Vite client connects directly to `ws://localhost:5173`
- NestJS restarts don't affect the WebSocket connection
- HMR works seamlessly even during server restarts

### TypeScript Configuration

**File:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

Key settings:
- `module: "nodenext"` - Proper ESM/CJS interop for NestJS
- `jsx: "react-jsx"` - Modern JSX transform (no need to import React)
- Include `.tsx` files for view components

### NestJS CLI Configuration

**File:** `nest-cli.json`

```json
{
  "compilerOptions": {
    "deleteOutDir": false,
    "watchAssets": true
  },
  "exclude": ["node_modules", "dist", "test"]
}
```

- `deleteOutDir: false` - Prevents clearing Vite-built assets
- `watchAssets: true` - Enables asset watching in development
- `exclude` - Prevents unnecessary file watching

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
└── main.ts                       # NestJS bootstrap with Vite integration
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
@Render('views/my-page')
@Get('/my-page')
getMyPage() {
  return { message: 'Hello World' };
}
```

## Common Issues

### HMR Not Working After Server Restart

**Symptom:** After editing a view file, you see "WebSocket connection lost" in the browser console.

**Solution:** Ensure `vite.config.js` has `hmr.port: 5173` configured (see above).

### "View not found in registry"

**Symptom:** Error when trying to render a view.

**Solution:**
1. Ensure the view file is in `src/**/views/*.tsx`
2. Check that the path matches: `@Render('views/my-page')` for `src/views/my-page.tsx`
3. Restart the dev servers to regenerate the registry

### Module Resolution Errors

**Symptom:** TypeScript can't find modules or types.

**Solution:** Ensure `tsconfig.json` has `module: "nodenext"` and `moduleResolution: "nodenext"`.

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

## Learn More

- [NestJS SSR React Documentation](../../packages/react/README.md)
- [NestJS Documentation](https://docs.nestjs.com)
- [Vite Documentation](https://vitejs.dev)
- [React Documentation](https://react.dev)
