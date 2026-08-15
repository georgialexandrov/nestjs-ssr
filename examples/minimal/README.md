# Minimal Example

The quickest way to get started with NestJS SSR React.

## Features

- ✅ Full Hot Module Replacement
- ✅ Instant React updates (no refresh)
- ✅ CSS hot reload
- ✅ SSR with hydration
- ⚡ Best developer experience

## Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
pnpm start:dev

# Visit http://localhost:3000
```

## Configuration

This example runs Vite on 5178, so the port is declared in two places and the
two must match:

```typescript
// src/app.module.ts — where NestJS proxies asset requests to
RenderModule.forRoot({ vite: { port: 5178 } });
```

```javascript
// vite.config.js — where Vite listens, and where the browser opens the HMR socket
server: { port: 5178, strictPort: true, ws: { clientPort: 5178 } }
```

`ws.clientPort` is not optional. The page is served by NestJS on :3000, so
without it Vite's client derives the HMR WebSocket from the page origin and
tries `ws://localhost:3000` — which NestJS does not answer with a handshake.
Vite's client waits for that socket to open or close with no timeout, so the
symptom is a console stuck on `[vite] connecting...` and HMR silently dead.

## How It Works

1. **Vite dev server** runs on port 5178 (client assets, HMR)
2. **NestJS server** runs on port 3000 (SSR, API)
3. NestJS proxies asset requests (`/src/`, `/@`, `/node_modules/`) to Vite
4. The browser's HMR WebSocket goes straight to Vite on 5178, so it survives
   the `nest start --watch` restart that every `.tsx` edit triggers (controllers
   import their view components, so tsc recompiles them)
5. Component changes update instantly without page refresh

## Scripts

- `pnpm start:dev` - Run both Vite and NestJS
- `pnpm dev:vite` - Run Vite only
- `pnpm dev:nest` - Run NestJS only
- `pnpm build` - Build for production
