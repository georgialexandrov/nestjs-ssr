# Development Setup

NestJS SSR supports two development modes: embedded mode (default) and proxy mode (advanced).

## Embedded Mode (Default)

Embedded mode runs Vite as middleware inside your NestJS server with full Hot Module Replacement (HMR) support. This is the default configuration when you import `RenderModule`.

```typescript
// app.module.ts
@Module({
  imports: [RenderModule], // Automatically configures embedded mode with full HMR
})
export class AppModule {}
```

```bash
npm run start:dev
```

That's it. No additional configuration needed.

**Benefits:**
- Zero configuration
- Single server (one process, one port)
- Full HMR with React Fast Refresh
- Simple debugging
- No additional dependencies

**Trade-offs:**
- NestJS restarts clear Vite cache
- Slightly slower HMR than proxy mode (still very fast)

**When to use:**
- **Default choice for most projects** (recommended)
- You want simplicity
- Small to medium applications
- Getting started with NestJS SSR

## Proxy Mode (Advanced)

Proxy mode runs Vite as a separate server. This provides the fastest possible HMR at the cost of additional complexity.

**Setup:**

Install dependencies:
```bash
npm install -D concurrently http-proxy-middleware
```

Configure proxy in `main.ts`:
```typescript
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (process.env.NODE_ENV !== 'production') {
    app.use(
      createProxyMiddleware({
        target: 'http://localhost:5173',
        changeOrigin: true,
        ws: true,
        pathFilter: (pathname) => {
          return (
            pathname.startsWith('/src/') ||
            pathname.startsWith('/@') ||
            pathname.startsWith('/node_modules/') ||
            pathname === '/@vite/client' ||
            pathname === '/@react-refresh'
          );
        },
      })
    );
  }

  await app.listen(3000);
}
```

Update `vite.config.ts`:
```typescript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});
```

Update `package.json`:
```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"nest start --watch\""
  }
}
```

**Benefits:**
- Fastest HMR updates
- Vite cache persists across NestJS restarts
- Separate process isolation

**Trade-offs:**
- More complex setup
- Two servers to manage (ports 3000 and 5173)
- Additional dependencies

**When to use:**
- Large applications with many components
- Maximum HMR performance needed
- Working primarily on UI

## Comparison

| Feature | Embedded | Proxy |
|---------|----------|-------|
| **Configuration** | Zero config | Manual setup |
| **HMR support** | Full | Full |
| **Update speed** | Fast | Faster |
| **Servers** | 1 | 2 |
| **Complexity** | Simple | Advanced |

## Example Implementations

See working examples in the repository:
- [Minimal Example (Embedded)](https://github.com/georgialexandrov/nestjs-ssr/tree/main/examples/minimal) - Zero-config embedded mode
- [Minimal HMR Example (Proxy)](https://github.com/georgialexandrov/nestjs-ssr/tree/main/examples/minimal-hmr) - Proxy mode setup

Both examples demonstrate full HMR with React Fast Refresh.

## Next Steps

- [Head Tags](/guide/head-tags) - Add meta tags and SEO
- [Core Concepts](/guide/core-concepts) - Understand SSR
