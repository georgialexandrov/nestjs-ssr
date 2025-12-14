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

```typescript
// src/app.module.ts
RenderModule.forRoot(); // Default: Vite on port 5173
```

## How It Works

1. **Vite dev server** runs on port 5173 (client assets, HMR)
2. **NestJS server** runs on port 3000 (SSR, API)
3. NestJS proxies asset requests to Vite
4. Changes update instantly without page refresh

## Scripts

- `pnpm start:dev` - Run both Vite and NestJS
- `pnpm dev:vite` - Run Vite only
- `pnpm dev:nest` - Run NestJS only
- `pnpm build` - Build for production
