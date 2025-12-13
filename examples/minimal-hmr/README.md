# Minimal HMR Example (Proxy Mode)

Full-featured NestJS SSR React setup with **Hot Module Replacement (HMR)**.

## Features

- ✅ Full Hot Module Replacement
- ✅ Instant React component updates (no refresh)
- ✅ CSS hot reload
- ✅ External Vite dev server (proxy mode)
- ⚡ Best developer experience

## Quick Start

\`\`\`bash

# Install dependencies

pnpm install

# Run both Vite and NestJS concurrently

pnpm start:dev

# Visit http://localhost:3000

\`\`\`

## Configuration

\`\`\`typescript
// src/app.module.ts
RenderModule.forRoot({
vite: { mode: 'proxy', port: 5173 }, // HMR mode
})
\`\`\`

## How It Works

1. **Vite dev server** runs on port 5173 (client assets, HMR)
2. **NestJS server** runs on port 3000 (SSR, API)
3. NestJS proxies asset requests to Vite automatically
4. Changes to React components update instantly without page refresh

## Scripts

- \`pnpm start:dev\` - Run both Vite and NestJS
- \`pnpm dev:vite\` - Run Vite only
- \`pnpm dev:nest\` - Run NestJS only

## Want Simpler Setup?

Check out the [\`minimal\`](../minimal) example for embedded mode (no HMR, single process).
