# NestJS React SSR - Implementation Roadmap

## Overview

This roadmap outlines the path from prototype to production-ready, open-source NestJS + React SSR framework. Priorities are ordered by effort (easy → hard) to deliver quick wins while building toward a production-grade solution.

---

## Phase 1: Quick Wins ⏱️ 2-4 hours total

These improvements provide immediate value with minimal effort and no breaking changes.

### 1.1 TypeScript Type Safety for Props ⏱️ 15 min
**Status:** ✅ COMPLETE
**Priority:** CRITICAL

- ✅ Created `PageProps<T>` generic interface
- ✅ Created `RenderContext` interface for request metadata (generic, easily extensible)
- ✅ Updated all components to use typed props
- ✅ Replaced `any` with proper generics in render functions
- ✅ Added explicit return types to all controllers
- ✅ Created React hooks for context access (useParams, useQuery, etc.)
- ✅ Updated entry-server and entry-client to pass context
- ✅ Serialized context to window.__CONTEXT__ for client hydration

**Benefits:**
- ✅ Full TypeScript type safety from controller to component
- ✅ IDE autocomplete for data and context properties
- ✅ Compile-time error detection for prop mismatches
- ✅ Context available both server-side and client-side
- ✅ No type assertions needed - declaration merging pattern for extensions

**Implementation:**
- `src/shared/render/interfaces/page-props.interface.ts` ✅
- `src/shared/render/interfaces/render-context.interface.ts` ✅
- `src/view/hooks/use-page-context.tsx` ✅
- `src/view/entry-server.tsx` ✅
- `src/view/entry-client.tsx` ✅
- `src/shared/render/render.interceptor.ts` ✅
- All view components updated ✅

---

### 1.2 Remove Hard-coded .js Extensions ⏱️ 10 min
**Status:** ✅ COMPLETE
**Priority:** HIGH

- ✅ Removed `.js` extensions from all TypeScript imports in `src/` directory
- ✅ Updated TypeScript module resolution to handle imports automatically
- ✅ Excluded `examples/` and `docs/` from tsconfig compilation
- ✅ Verified TypeScript compilation (0 errors)
- ✅ Tested application functionality

**Benefits:**
- ✅ Cleaner, more portable code following TypeScript conventions
- ✅ Consistent with standard TypeScript practices
- ✅ Better IDE support and autocomplete
- ✅ Easier refactoring (no need to update extension references)

**Files modified:**
- All TypeScript files in `src/` directory (15+ files)
- `tsconfig.json` (added exclude for examples and docs)

---

### 1.3 Basic Error Boundaries ⏱️ 30 min
**Status:** Pending
**Priority:** HIGH

- Create React Error Boundary component
- Wrap views in error boundaries
- Prevent full page crashes from component errors
- Better error messages in development

**Files to create:**
- `src/shared/views/error-boundary.tsx`

**Files to modify:**
- `src/view/app.tsx` (wrap with ErrorBoundary)

---

### 1.4 Security Headers ⏱️ 20 min
**Status:** Pending
**Priority:** MEDIUM

- Install and configure Helmet.js
- Add Content Security Policy (CSP)
- XSS protection headers
- HTTPS enforcement

**Dependencies:**
```bash
pnpm add helmet
pnpm add -D @types/helmet
```

**Files to modify:**
- `src/main.ts` (add Helmet middleware)

---

### 1.5 Basic HTTP Cache Headers ⏱️ 20 min
**Status:** Pending
**Priority:** HIGH

- Add Cache-Control headers for static assets
- Configure Vite middleware for asset caching
- Immediate performance boost

**Files to modify:**
- `src/main.ts` (static asset headers)
- `vite.config.ts` (build output with hashing)

---

### 1.6 Hydration Mismatch Detection ⏱️ 15 min
**Status:** Pending
**Priority:** MEDIUM

- Enable React 18 strict mode in development
- Add console warnings for hydration mismatches
- Helps debug SSR/client inconsistencies

**Files to modify:**
- `src/view/entry-client.tsx` (StrictMode wrapper)

---

## Phase 2: Production Essentials ⏱️ 1-2 days total

Required for deploying to production environments.

### 2.1 Environment-Aware Bootstrap ⏱️ 2-3 hours
**Status:** Pending
**Priority:** CRITICAL (blocker for deployment)

- Detect `NODE_ENV` (development vs production)
- Load Vite dev server only in development
- Load pre-built assets in production
- Environment-specific configuration

**Files to modify:**
- `src/main.ts` (conditional Vite loading)
- `src/shared/render/render.service.ts` (env-aware rendering)

**Pattern:**
```typescript
if (process.env.NODE_ENV === 'production') {
  // Load from dist/client
} else {
  // Use Vite dev server
}
```

---

### 2.2 Production Build System ⏱️ 4-6 hours
**Status:** Pending
**Priority:** CRITICAL (blocker for deployment)

- Vite build scripts for client bundle
- Vite build scripts for server bundle
- Asset manifest generation
- Fingerprinted filenames for cache busting
- Serve pre-built assets in production

**Files to create:**
- `scripts/build.ts` (build orchestration)

**Files to modify:**
- `vite.config.ts` (dual entry points, SSR config)
- `package.json` (build scripts)
- `src/shared/render/render.service.ts` (load from manifest)

**New npm scripts:**
```json
{
  "build": "pnpm build:client && pnpm build:server && nest build",
  "build:client": "vite build --outDir dist/client",
  "build:server": "vite build --ssr src/view/entry-server.tsx --outDir dist/server",
  "start:prod": "NODE_ENV=production node dist/main"
}
```

---

### 2.3 Error Logging & Monitoring ⏱️ 2-3 hours
**Status:** Pending
**Priority:** HIGH

- Integrate Sentry for error tracking
- Log SSR errors with context
- Track hydration failures
- Performance monitoring

**Dependencies:**
```bash
pnpm add @sentry/node @sentry/react
```

**Files to create:**
- `src/shared/monitoring/sentry.service.ts`

**Files to modify:**
- `src/main.ts` (Sentry initialization)
- `src/view/entry-client.tsx` (Sentry React integration)
- `src/shared/render/render.interceptor.ts` (log errors to Sentry)

---

### 2.4 Basic Docker Support ⏱️ 2 hours
**Status:** Pending
**Priority:** MEDIUM

- Create production Dockerfile
- Multi-stage build (dependencies → build → runtime)
- Optimize image size
- Docker Compose for local testing

**Files to create:**
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`

---

## Phase 3: Scalability & Developer Experience ⏱️ 3-5 days total

Essential for open-source adoption and scaling beyond prototype.

### 3.1 Auto-Generated View Registry ⏱️ 1-2 days
**Status:** Pending
**Priority:** CRITICAL (biggest pain point for users)

**Problem:**
Currently, every new view requires manual edits to TWO files:
- `src/view/entry-server.tsx` (add import + registry entry)
- `src/view/entry-client.tsx` (add import + registry entry)

This doesn't scale and will frustrate users.

**Solution Options:**

**Option A: Vite Plugin (Recommended)**
- Build-time plugin scans `**/views/*.tsx`
- Auto-generates `view-registry.ts`
- Both entry files import from generated registry
- Zero manual maintenance

**Option B: Build Script**
- Pre-build script using `glob` to scan views
- Generates TypeScript file with imports
- Runs before `pnpm start:dev`

**Files to create:**
- `vite-plugins/view-registry-plugin.ts` (Option A)
- OR `scripts/generate-view-registry.ts` (Option B)
- `src/view/generated-view-registry.ts` (auto-generated, git-ignored)

**Files to modify:**
- `vite.config.ts` (add plugin)
- `.gitignore` (ignore generated file)
- `src/view/entry-server.tsx` (import from generated)
- `src/view/entry-client.tsx` (import from generated)

**Success criteria:**
- Add new view file → automatically available (no manual edits)
- Type-safe view paths
- Works with HMR

---

### 3.2 Code Splitting & Optimization ⏱️ 1-2 days
**Status:** Pending
**Priority:** HIGH

- Dynamic imports for route-level code splitting
- Lazy load non-critical components
- Bundle analysis and size optimization
- Image optimization
- CSS extraction and minification

**Files to modify:**
- `vite.config.ts` (rollup config, chunk splitting)
- Components (convert to lazy imports where appropriate)

**Tools:**
- `vite-plugin-compression` (Brotli/Gzip)
- `rollup-plugin-visualizer` (bundle analysis)

---

### 3.3 Streaming SSR (renderToPipeableStream) ⏱️ 2-3 days
**Status:** Pending
**Priority:** MEDIUM (performance optimization)

- Switch from `renderToString` to `renderToPipeableStream`
- Support React 18+ Suspense
- Progressive rendering
- Reduce Time to First Byte (TTFB)

**Files to modify:**
- `src/view/entry-server.tsx` (streaming rendering)
- `src/shared/render/render.service.ts` (pipe to response)
- Components (wrap slow parts in Suspense)

**Challenges:**
- More complex error handling
- Template injection (inline scripts for streamed content)
- Testing hydration timing

---

### 3.4 Advanced Caching (Redis) ⏱️ 2-3 days
**Status:** Pending
**Priority:** LOW (optimization for high traffic)

- Redis integration for page caching
- Cache invalidation strategies
- Configurable TTL per route
- Stale-while-revalidate pattern

**Dependencies:**
```bash
pnpm add ioredis
pnpm add -D @types/ioredis
```

**Files to create:**
- `src/shared/cache/cache.service.ts`
- `src/shared/cache/cache.module.ts`

**Files to modify:**
- `src/shared/render/render.interceptor.ts` (check cache before render)

---

## Phase 4: Post-Launch Enhancements

Nice-to-have features that can be added incrementally.

### 4.1 File-Based Routing
- Auto-register routes from file structure
- Convention over configuration
- Similar to Next.js/Nuxt

### 4.2 tRPC Integration
- Type-safe API calls from client
- End-to-end type safety
- Auto-generated types

### 4.3 Internationalization (i18n)
- Multi-language support
- SSR-compatible i18n
- Language detection from headers

### 4.4 Advanced Developer Tools
- Custom DevTools panel
- Performance profiling
- Component inspector

---

## Success Metrics

### Prototype → Production
- [ ] Passes TypeScript strict mode with zero `any`
- [ ] Production build completes without errors
- [ ] Lighthouse score > 90
- [ ] Bundle size < 100KB (gzipped)
- [ ] TTFB < 200ms
- [ ] Zero hydration mismatches

### Open Source Ready
- [ ] Auto-generated view registry working
- [ ] Complete documentation
- [ ] Example application
- [ ] CI/CD pipeline
- [ ] npm package published
- [ ] GitHub Stars > 100 (within 3 months)

---

## Timeline Estimates

**Week 1: Foundation**
- Days 1-2: Phase 1 (Quick Wins)
- Days 3-4: Phase 2.1-2.2 (Environment + Build)
- Day 5: Phase 3.1 (View Registry - start)

**Week 2: Production Ready**
- Days 1-2: Phase 3.1 (View Registry - complete)
- Day 3: Phase 2.3 (Monitoring)
- Day 4: Phase 2.4 (Docker)
- Day 5: Testing, bug fixes, documentation

**Week 3: Polish & Launch**
- Days 1-2: Phase 3.2 (Optimization)
- Days 3-4: Example app, docs, README
- Day 5: Publish to npm, announce

---

## Current Status

**Completed:**
- ✅ Basic SSR with React
- ✅ Client-side hydration
- ✅ Vite integration (dev mode)
- ✅ Module-based architecture
- ✅ Custom `@ReactRender` decorator
- ✅ HMR for React components
- ✅ TypeScript support
- ✅ Type safety with generic PageProps and RenderContext (Phase 1.1)
- ✅ Removed .js extensions from TypeScript imports (Phase 1.2)

**Next Up:**
- ⏭️ Error boundaries (Phase 1.3)
- ⏭️ Security headers (Phase 1.4)
- ⏭️ Production build system (Phase 2.2)

---

## Notes

- All phases are non-breaking unless explicitly noted
- Each phase can be completed independently
- Priority may shift based on user feedback
- Open-source release target: End of Week 3
