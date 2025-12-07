# Examples

This directory contains example applications demonstrating different NestJS SSR React setups.

## 📦 Available Examples

### 1. **minimal** - Simplest Setup (Embedded Mode)
The fastest way to get started. Perfect for learning or prototyping.

**Features:**
- ✅ One-line configuration
- ✅ Vite runs inside NestJS (embedded mode)
- ✅ Single process - just `pnpm start:dev`
- ❌ No HMR (manual refresh needed)

**When to use:**
- Getting started with NestJS SSR
- Simple prototypes
- Don't need instant updates
- Want minimal complexity

**Run:**
```bash
cd minimal
pnpm install
pnpm start:dev
```

---

### 2. **minimal-hmr** - Full HMR (Proxy Mode)
Complete development experience with Hot Module Replacement.

**Features:**
- ✅ Full Hot Module Replacement
- ✅ Instant React updates (no refresh)
- ✅ CSS hot reload
- ✅ External Vite server (proxy mode)
- ⚡ Best DX

**When to use:**
- Active development
- Frequent component changes
- Need instant feedback
- Professional workflow

**Run:**
```bash
cd minimal-hmr
pnpm install
pnpm start:dev  # Runs Vite + NestJS
```

---

### 3. **full-featured** - Production-Ready
Complete example with all features, testing, and best practices.

**Features:**
- ✅ Streaming SSR
- ✅ Code splitting
- ✅ SEO optimization
- ✅ Error boundaries
- ✅ Testing setup
- ✅ Production builds

**When to use:**
- Building real applications
- Need advanced features
- Production deployments
- Learn best practices

**Run:**
```bash
cd full-featured
pnpm install
pnpm start:dev
```

---

## Quick Comparison

| Feature | minimal | minimal-hmr | full-featured |
|---------|---------|-------------|---------------|
| Setup Complexity | ⭐ Simple | ⭐⭐ Medium | ⭐⭐⭐ Advanced |
| HMR Support | ❌ No | ✅ Yes | ✅ Yes |
| Processes | 1 | 2 | 2 |
| Best For | Learning | Development | Production |

## Development Commands

From the monorepo root:

```bash
# Run minimal (embedded mode)
pnpm dev:minimal

# Run minimal-hmr (HMR mode)
pnpm dev:minimal-hmr

# Run full-featured
pnpm dev:full
```

## Mode Comparison

### Embedded Mode (`minimal`)
```typescript
RenderModule.register({
  vite: { mode: 'embedded' }
})
```
- Vite runs inside NestJS
- One process to manage
- No HMR
- Simpler setup

### Proxy Mode (`minimal-hmr`, `full-featured`)
```typescript
RenderModule.register({
  vite: { mode: 'proxy', port: 5173 }
})
```
- External Vite dev server
- Two processes (Vite + NestJS)
- Full HMR support
- Better DX
