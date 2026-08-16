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

## NODE_ENV

Development mode is opt-in: `NODE_ENV` must be exactly `development`, or you
must pass `RenderModule.forRoot({ environment: 'development' })`. Unset,
`test` and anything else run the production pipeline, which expects a built
client bundle and hides error detail.

The `init` CLI puts `NODE_ENV=development` in the generated `dev:nest` script.
If you see `NODE_ENV is not set - running in PRODUCTION mode` at startup, add
it to yours.

The reason it works this way: development mode proxies project sources through
the Vite dev server and renders stack traces into error pages. Defaulting to
that on an unset variable meant a deployment that forgot `NODE_ENV` shipped
both.

## Dev proxy scope

The proxy that forwards `/src/*`, `/@*` and `/node_modules/*` to Vite only
answers loopback clients. Vite binds to localhost; NestJS binds every
interface, so serving remote peers would expose your project's sources — and
Vite's `/@fs/` endpoint — to the whole network.

Host, Origin, socket-peer, and forwarding headers are checked together. This
prevents a DNS-rebinding page or a local reverse proxy from turning a loopback
socket into implicit authorization.

If your browser really is on another machine (container, LAN device testing),
allowlist its exact public hostname and origin:

```typescript
RenderModule.forRoot({
  vite: {
    port: 5173,
    allowedHosts: ['dev.example.test'],
    allowedOrigins: ['http://dev.example.test:3000'],
  },
});
```

When using a reverse proxy, preserve the original Host and forwarding headers;
the public hostname must be in `allowedHosts`. Prefer an SSH tunnel when you
can, since the Vite proxy exposes source files by design.

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
