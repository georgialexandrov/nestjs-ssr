# Examples

This directory contains example applications demonstrating NestJS SSR React.

## Minimal Example

The quickest way to get started with NestJS SSR React.

**Features:**

- ✅ Full Hot Module Replacement
- ✅ Instant React updates (no refresh)
- ✅ CSS hot reload
- ⚡ Best developer experience

**Run:**

```bash
cd minimal
pnpm install
pnpm start:dev  # Runs Vite + NestJS concurrently
```

## How It Works

1. **Vite dev server** runs on port 5173 (client assets, HMR)
2. **NestJS server** runs on port 3000 (SSR, API)
3. NestJS proxies asset requests to Vite automatically
4. Changes to React components update instantly without page refresh

## Configuration

```typescript
// Default - Vite on port 5173
RenderModule.forRoot();

// Custom Vite port
RenderModule.forRoot({
  vite: { port: 3001 },
});

// With SSR mode and head defaults
RenderModule.forRoot({
  mode: 'stream', // 'string' | 'stream'
  defaultHead: { title: 'My App' },
});
```

## Development Commands

From the monorepo root:

```bash
pnpm dev:minimal
```
