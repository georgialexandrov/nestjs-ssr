# Hot Module Replacement (HMR) Architecture

## Problem

In a NestJS + Vite SSR application, achieving true Hot Module Replacement without losing React state is challenging due to a fundamental architectural issue:

### Why Vite Middleware Mode Fails

When Vite runs as middleware inside NestJS:

1. ✅ Vite HMR detects `.tsx` file changes instantly
2. ✅ Vite sends HMR update to browser via WebSocket
3. ❌ **NestJS watch mode** detects the same file change (~1 second later)
4. ❌ **NestJS process restarts** to recompile TypeScript
5. ❌ **Vite middleware instance is destroyed** when NestJS restarts
6. ❌ **HMR WebSocket connection is severed**
7. ❌ **Browser loses connection** and triggers full page reload
8. ❌ **React state is lost**

**The core issue**: NestJS's TypeScript watch mode cannot selectively ignore files. When view files (`.tsx`) change, NestJS sees them as TypeScript files and triggers a restart, destroying the embedded Vite instance.

### Failed Approaches

#### 1. tsconfig.json `exclude`
```json
{
  "exclude": ["src/view/**/*.tsx", "src/**/views/**/*.tsx"]
}
```
**Result**: Only excludes from compilation, not from watch detection.

#### 2. nest-cli.json `exclude`
```json
{
  "exclude": ["src/view/**/*.tsx"]
}
```
**Result**: Doesn't affect watch mode behavior.

#### 3. Webpack Mode with `watchOptions.ignored`
```javascript
{
  "compilerOptions": {
    "webpack": true,
    "watchOptions": {
      "ignored": ["**/*.tsx"]
    }
  }
}
```
**Result**: Configuration errors and architectural complexity. User preference to avoid changing NestJS build system.

## Solution: Two-Process Architecture

Run Vite and NestJS as **separate, independent processes** that communicate via HTTP proxy.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                      │
│  • Requests pages from http://localhost:3000                │
│  • Connects to HMR WebSocket on port 5173                   │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ NestJS (Port 3000)                                          │
│  • Handles SSR rendering                                    │
│  • Proxies client assets to Vite (port 5173)               │
│  • Can restart without affecting Vite                       │
└────────────┬────────────────────────────────────────────────┘
             │ (HTTP Proxy for /src/, /@, /node_modules/)
             ▼
┌─────────────────────────────────────────────────────────────┐
│ Vite (Port 5173)                                            │
│  • Serves client-side modules and assets                    │
│  • Maintains HMR WebSocket connection                       │
│  • Runs independently from NestJS                           │
│  • Never restarts when .tsx files change                    │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Details

#### 1. package.json Scripts

```json
{
  "scripts": {
    "dev:vite": "vite --port 5173",
    "dev:nest": "nest start --watch --entryFile src/main",
    "start:dev": "concurrently -n vite,nest -c cyan,green \"pnpm dev:vite\" \"pnpm dev:nest\""
  }
}
```

#### 2. Vite Configuration (vite.config.ts)

Conditionally enable middleware mode only for SSR:

```typescript
export default defineConfig({
  server: {
    // Standalone mode when run via `pnpm dev:vite`
    // Middleware mode only for SSR instance created by NestJS
    middlewareMode: process.env.VITE_MIDDLEWARE === 'true',
    port: 5173,
    hmr: {
      port: 5173,
    },
  },
  appType: process.env.VITE_MIDDLEWARE === 'true' ? 'custom' : 'spa',
});
```

#### 3. NestJS Proxy Setup (src/main.ts)

```typescript
if (isDevelopment) {
  const { createProxyMiddleware } = await import('http-proxy-middleware');

  // Proxy client-side requests to external Vite dev server
  const viteProxy = createProxyMiddleware({
    target: 'http://localhost:5173',
    changeOrigin: true,
    ws: true, // Enable WebSocket proxying for HMR
    pathFilter: (pathname: string) => {
      return (
        pathname.startsWith('/src/') ||
        pathname.startsWith('/@') ||
        pathname.startsWith('/node_modules/') ||
        pathname.startsWith('/images/') ||
        /\.(jpg|jpeg|png|gif|svg|webp|ico)$/.test(pathname)
      );
    },
  });
  app.use(viteProxy);

  // Separate Vite instance for SSR module loading
  process.env.VITE_MIDDLEWARE = 'true';
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  renderService.setViteServer(vite);
}
```

### Registry Plugin Optimization

To prevent unnecessary rebuilds, the view registry plugin skips regeneration in SSR middleware mode:

```typescript
// src/view/view-registry-plugin.ts
async buildStart() {
  // Only regenerate if not in SSR middleware mode
  if (process.env.VITE_MIDDLEWARE !== 'true') {
    await generateRegistry();
  }
},

configureServer(server) {
  // Skip watcher setup in SSR middleware mode
  if (process.env.VITE_MIDDLEWARE === 'true') {
    return;
  }
  // ... file watchers
}
```

This prevents the SSR Vite instance from regenerating the registry when NestJS restarts, avoiding unnecessary full page reloads.

## Flow Diagram

### Successful HMR Flow

```
1. Developer edits showcase.tsx
   ↓
2. Standalone Vite (port 5173) detects change
   ↓
3. Vite sends HMR update via WebSocket
   ↓
4. Browser receives update instantly
   ↓
5. React Fast Refresh updates component
   ↓
6. ✅ React state preserved!
   ↓
7. NestJS detects change 1 second later
   ↓
8. NestJS restarts (background)
   ↓
9. SSR Vite instance recreated (no registry regeneration)
   ↓
10. ✅ Browser HMR connection unaffected!
```

### What the Browser Sees

```
Time    Event
────────────────────────────────────────────────
0.0s    User edits file
0.1s    Vite HMR update received
0.1s    Component hot-reloaded (state preserved)
1.0s    (NestJS restarts in background - invisible to user)
```

## Benefits

1. ✅ **True HMR**: Changes appear instantly without page reload
2. ✅ **State Preservation**: React state (form inputs, dialog state, etc.) is maintained
3. ✅ **Fast Feedback Loop**: ~100ms vs ~1000ms+ reload time
4. ✅ **Simple Architecture**: Clean separation of concerns
5. ✅ **Single Command**: `pnpm start:dev` runs both processes via concurrently

## Trade-offs

### Pros
- Reliable HMR that always works
- React state is never lost
- Fast development experience
- Clear separation between client and server

### Cons
- Requires two processes (mitigated by `concurrently`)
- Slightly more complex setup than pure middleware
- Proxy adds minimal latency (~1-2ms)

## Alternative Approaches Considered

### Option 1: nodemon with ignore patterns
**Problem**: Requires running NestJS through a wrapper tool, against user preference.

### Option 2: Webpack mode with custom watch config
**Problem**: Requires changing NestJS build system, adds complexity, configuration errors.

### Option 3: Custom TypeScript watch mode
**Problem**: Would require forking NestJS CLI or using custom build scripts.

### Option 4: Accept page reloads
**Problem**: Poor developer experience, loses React state on every change.

## Conclusion

The two-process architecture is the **optimal solution** for NestJS + Vite SSR applications that require true HMR. While slightly more complex than middleware mode, it provides a **vastly superior developer experience** with instant updates and state preservation.

The pattern is:
- **Vite runs independently** for client-side concerns (HMR, module serving)
- **NestJS proxies to Vite** for client assets
- **Both can restart independently** without affecting the other
- **Browser maintains WebSocket connection** to the stable Vite process
