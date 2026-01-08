# Development

## Starting Development

```bash
pnpm start:dev
```

This runs both Vite and NestJS concurrently with full HMR support.

## How It Works

1. **Vite dev server** runs on port 5173 (client assets, HMR)
2. **NestJS server** runs on port 3000 (SSR, API)
3. NestJS proxies asset requests to Vite
4. Component changes hot-reload instantly

## Running Separately

If you prefer separate terminals:

```bash
# Terminal 1
pnpm dev:vite

# Terminal 2
pnpm dev:nest
```

## Custom Vite Port

```typescript
// app.module.ts
RenderModule.forRoot({
  vite: { port: 3001 },
});
```

Update your `vite.config.ts` and `dev:vite` script to match.

## Production

```bash
pnpm build
pnpm start:prod
```

Vite builds optimized bundles. Manifest tells NestJS which chunks to load.
