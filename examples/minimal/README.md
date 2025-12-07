# Minimal Example (Embedded Mode)

The **simplest** NestJS SSR React setup. Perfect for getting started quickly or when you don't need HMR.

## Features

- ✅ One-line module registration
- ✅ Vite runs inside NestJS (embedded mode)
- ✅ Single process - just run `pnpm start:dev`
- ✅ SSR with React
- ❌ No HMR (manual browser refresh needed)

## Quick Start

\`\`\`bash
# Install dependencies
pnpm install

# Run development server
pnpm start:dev

# Visit http://localhost:3000
\`\`\`

## Configuration

\`\`\`typescript
// src/app.module.ts
RenderModule.register({
  vite: { mode: 'embedded' }, // Simplest setup
})
\`\`\`

## When to Use

- Getting started with NestJS SSR
- Simple prototypes or demos
- Don't need instant component updates
- Want minimal configuration

## Want HMR?

Check out the [\`minimal-hmr\`](../minimal-hmr) example for full Hot Module Replacement support.
