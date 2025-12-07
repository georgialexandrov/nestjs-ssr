# Development Setup

This guide helps you choose between two development approaches: embedded mode or proxy mode.

## The Choice

You can run Vite in two ways during development:

1. **Embedded Mode**: Vite middleware in NestJS (single server, full HMR)
2. **Proxy Mode**: Separate Vite server (two servers, advanced HMR)

Both support HMR. Choose based on your needs.

## Embedded Mode (Recommended)

### How It Works

Vite runs as middleware inside your NestJS server. Full HMR support with React Fast Refresh works automatically.

```typescript
// main.ts
import { createServer as createViteServer } from 'vite';

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

```json
// package.json
{
  "scripts": {
    "dev": "nest start --watch"
  }
}
```

Or use zero-config by importing `RenderModule` directly:

```typescript
// app.module.ts
@Module({
  imports: [RenderModule], // Automatically configures embedded mode
})
export class AppModule {}
```

### Pros

- **Simple**: One server, zero configuration
- **Full HMR**: React Fast Refresh works automatically
- **Fewer moving parts**: No proxy, no port management
- **Easy to debug**: Single process to inspect

### Cons

- **Slower HMR**: Slightly slower than proxy mode (50-100ms vs <50ms)
- **Server restarts**: NestJS restarts clear Vite cache

### When to Use

- Getting started
- Most applications
- You prefer simplicity over maximum HMR speed
- Working on smaller to medium projects

## Proxy Mode (Advanced HMR)

### How It Works

Vite runs as a separate server. When you change a React component, it updates in the browser instantly without page refresh. Component state stays intact.

```typescript
// main.ts
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const renderService = app.get(RenderService);

  if (process.env.NODE_ENV !== 'production') {
    // Proxy to Vite dev server for HMR
    app.use(
      createProxyMiddleware({
        target: 'http://localhost:5173',
        changeOrigin: true,
        ws: true,
        pathFilter: (pathname) => {
          return (
            pathname.startsWith('/src/') ||
            pathname.startsWith('/@') ||
            pathname.startsWith('/node_modules/')
          );
        },
      })
    );

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

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react(), viewRegistryPlugin()],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
```

```json
// package.json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"nest start --watch\""
  },
  "devDependencies": {
    "concurrently": "^8.0.0",
    "http-proxy-middleware": "^2.0.0"
  }
}
```

### Pros

- **Fastest HMR**: Optimal update speed (<50ms)
- **Isolated processes**: NestJS restarts don't affect Vite
- **Better for large projects**: Vite cache persists independently
- **Advanced debugging**: Separate process monitoring

### Cons

- **More complex**: Two servers, proxy configuration
- **More dependencies**: Concurrently, http-proxy-middleware
- **More ports**: 3000 (NestJS) and 5173 (Vite)
- **Harder to debug**: Two processes to monitor

### When to Use

- Large applications with many components
- Maximum HMR performance needed
- Working primarily on UI/frontend
- Team prefers dedicated Vite server

## Comparison

| Feature | Embedded Mode | Proxy Mode |
|---------|--------------|-----|
| **Setup complexity** | Zero config | Medium |
| **HMR support** | Full (React Fast Refresh) | Full (React Fast Refresh) |
| **Update speed** | Fast (50-100ms) | Fastest (<50ms) |
| **State preservation** | Yes | Yes |
| **Number of servers** | 1 | 2 |
| **Dependencies** | None (built-in) | concurrently, proxy |
| **Port management** | Simple | Need 2 ports |

## Switching Between Setups

You can start with embedded mode and switch to proxy mode later if needed.

### From Embedded to Proxy Mode

1. Install dependencies:
```bash
npm install -D concurrently http-proxy-middleware
```

2. Add proxy middleware in `main.ts`

3. Update `vite.config.ts` with HMR port

4. Change scripts in `package.json` to run both servers

### From Proxy to Embedded Mode

1. Remove proxy middleware from `main.ts`

2. Simplify `vite.config.ts`

3. Update scripts in `package.json` to run single server

4. Optionally remove unused dependencies

No code changes needed in controllers or components.

## Recommendation

**Start with embedded mode**: Zero configuration, full HMR, single server. Perfect for most applications.

**Upgrade to proxy mode**: Only if you need maximum HMR performance or are working on a large application with hundreds of components.

Both provide full HMR with React Fast Refresh. Choose based on your project size and performance needs.

## Next Steps

- [Getting Started](/guide/getting-started) - Set up your first page
- [Core Concepts](/guide/core-concepts) - Understand SSR
- [Troubleshooting](/troubleshooting) - Fix HMR issues
