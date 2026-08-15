# Development

## Starting Development

```bash
pnpm start:dev
```

This runs both Vite and NestJS concurrently with full HMR support.

## How It Works

1. **Vite dev server** runs on port 5173 (client assets, HMR)
2. **NestJS server** runs on port 3000 (SSR, API)
3. NestJS proxies asset requests (`/src/`, `/@`, `/node_modules/`) and Vite's
   HMR WebSocket to Vite
4. Component changes hot-reload instantly

## HMR WebSocket

Your pages are served by NestJS on :3000, but Vite's HMR client derives its
WebSocket URL from the page origin. Point it at Vite explicitly:

```javascript
// vite.config.ts
server: {
  port: 5173,
  strictPort: true,
  ws: { clientPort: 5173 },
}
```

Without `ws.clientPort` the client opens `ws://localhost:3000` instead. NestJS
proxies that handshake through to Vite, so HMR still works — but the socket is
torn down on every `nest start --watch` restart, and since controllers import
their view components, a `.tsx` edit triggers exactly that restart. Connecting
straight to Vite keeps the channel alive across restarts, so hot updates stay
hot instead of degrading to full page reloads.

`strictPort` is worth setting too: without it Vite silently slides to the next
free port and the NestJS proxy ends up pointing at nothing.

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
