# Production Deployment Risks & Mitigation

## Overview

This document catalogs all identified risks preventing production deployment of the current prototype, along with their severity, impact, and mitigation strategies.

---

## Risk Assessment Scale

- **🔴 CRITICAL**: Blocks deployment, causes crashes/failures
- **🟠 HIGH**: Major issues, poor UX, scalability problems
- **🟡 MEDIUM**: Degraded performance, maintenance burden
- **🟢 LOW**: Minor issues, cosmetic problems

---

## 1. Production Build Process ✅ RESOLVED (Phase 2.2)

### Status: COMPLETE

Production build system is fully implemented and tested.

### Implementation
```typescript
// main.ts - Environment-aware bootstrap
const isDevelopment = process.env.NODE_ENV !== 'production';

if (isDevelopment) {
  // Development: Vite dev server with HMR
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  renderService.setViteServer(vite);
  app.use(vite.middlewares);
} else {
  // Production: Serve pre-built assets with cache headers
  app.use(
    '/assets',
    express.static('dist/client/assets', {
      setHeaders: (res: Response, path: string) => {
        const hasHash = /\.[a-f0-9]{8,}\.(js|css)/.test(path);
        if (hasHash) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
        }
      },
    }),
  );
}
```

### Build Scripts
```json
{
  "build": "pnpm build:client && pnpm build:server && nest build",
  "build:client": "vite build --outDir dist/client && cp src/view/template.html dist/client/template.html",
  "build:server": "vite build --ssr src/view/entry-server.tsx --outDir dist/server",
  "start:prod": "NODE_ENV=production node dist/src/main"
}
```

### Results
- ✅ Client bundle: ~202KB (optimized with content hashing)
- ✅ Server bundle: ~21KB
- ✅ Content-hashed filenames for cache busting
- ✅ Manifest-based asset loading in production
- ✅ Separate cache strategies for hashed vs non-hashed assets
- ✅ ~1 second cold start in production
- ✅ No Vite dev server overhead in production

---

## 2. Manual View Registry (Scalability Nightmare) 🟠 HIGH

### Current State
Every new view requires manual edits to TWO files:

```typescript
// src/view/entry-server.tsx
import UserList from '../users/views/user-list.js';
const viewRegistry = { 'users/views/user-list': UserList };

// src/view/entry-client.tsx
import UserList from '../users/views/user-list.js';
const viewRegistry = { 'users/views/user-list': UserList };
```

### Problems
- ❌ Easy to forget updating both files → runtime errors in production
- ❌ Typos in registry → silent failures
- ❌ Doesn't scale beyond ~10-20 components
- ❌ Copy-paste errors likely
- ❌ No compile-time validation that paths match files

### Production Scenario
```
Developer adds new view:
  ✅ Creates src/products/views/product-detail.tsx
  ❌ Forgets to add to entry-server.tsx
  ❌ Adds typo in entry-client.tsx ('product-details' vs 'product-detail')

Production deploy:
  ✅ Build succeeds (no compile errors)
  ❌ Runtime error: "Component not found: products/views/product-detail"
  ❌ 500 error to users
  ❌ No way to catch before deployment
```

### Impact
- Developer frustration (manual work)
- Production errors from forgotten registrations
- Poor open-source adoption (too much boilerplate)
- Makes project unusable at scale

### Mitigation Strategy (Phase 3.1)

**Option A: Vite Plugin (Recommended)**
```typescript
// vite-plugins/view-registry-plugin.ts
export function viewRegistryPlugin() {
  return {
    name: 'view-registry',
    configureServer(server) {
      // Watch **/views/*.tsx files
      // Auto-generate src/view/generated-view-registry.ts
    }
  }
}

// Generated output
export const viewRegistry = {
  'users/views/user-list': lazy(() => import('../users/views/user-list')),
  'users/views/user-profile': lazy(() => import('../users/views/user-profile')),
  'products/views/product-detail': lazy(() => import('../products/views/product-detail')),
}
```

**Option B: Pre-build Script**
```bash
# Runs before start:dev
pnpm generate:views
```

---

## 3. No Asset Optimization 🟠 HIGH

### Missing Optimizations
- ❌ Code splitting (entire app in one bundle)
- ❌ Lazy loading for routes
- ❌ CSS extraction and minification
- ❌ Image optimization
- ❌ Tree-shaking dead code
- ❌ Bundle size analysis

### Current Performance
| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Bundle size | ~800KB | ~50-100KB | 8-16x too large |
| Time to Interactive | 3-5s | 0.5-1.5s | 3-5x too slow |
| First Contentful Paint | 800ms | 200ms | 4x too slow |
| Lighthouse Score | ~60 | >90 | Failing |

### Impact
- Poor user experience on slow networks
- SEO penalties from Google
- High bounce rates
- Users on mobile/3G can't use app

### Mitigation Strategy (Phase 3.2)
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-components': ['src/shared/views'],
        }
      }
    }
  },
  plugins: [
    compression({ algorithm: 'brotliCompress' }), // Brotli compression
  ]
})
```

---

## 4. HTTP Caching Strategy ✅ PARTIALLY RESOLVED

### Current State: Asset Caching Implemented

Static assets are served with appropriate cache headers:

```typescript
// Production: Serve static files with cache headers
app.use(
  '/assets',
  express.static('dist/client/assets', {
    setHeaders: (res: Response, path: string) => {
      const hasHash = /\.[a-f0-9]{8,}\.(js|css)/.test(path);

      if (hasHash) {
        // Immutable assets with content hash - cache for 1 year
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        // Assets without hash - cache for 1 hour with revalidation
        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      }
    },
  }),
);
```

### What's Implemented ✅
- ✅ Content-hashed filenames enable long-term caching (1 year)
- ✅ Non-hashed assets cached for 1 hour with revalidation
- ✅ `immutable` directive for hashed files (best performance)
- ✅ Works with CDNs out of the box

### What's Still Needed 🟡
- ⚠️ No HTML response caching (every request re-renders)
- ⚠️ No CDN integration for HTML
- ⚠️ Database queries repeated on every request
- ⚠️ SSR rendering repeated unnecessarily

### Future: Response Caching (Phase 3.4) ⏱️ 2-3 days
```typescript
// Check Redis cache before rendering
const cached = await redis.get(`page:${url}`);
if (cached) return cached;

// Render and cache
const html = await renderComponent(...);
await redis.set(`page:${url}`, html, 'EX', 60);
```

### Impact
- ✅ Static assets efficiently cached
- ⚠️ HTML responses still re-rendered on every request
- 🎯 Can handle moderate traffic (~50-100 req/sec)
- 🎯 High traffic (>100 req/sec) will need response caching

---

## 5. renderToString vs Streaming SSR 🟡 MEDIUM

### Current Implementation
```typescript
const html = renderToString(<Component />);
// Waits for ENTIRE component tree before sending response
```

### Problems
- ⚠️ Blocking: Can't send HTML until everything renders
- ⚠️ Slow data fetching blocks entire page
- ⚠️ High Time to First Byte (TTFB)
- ⚠️ User sees blank screen while waiting

### Performance Comparison
```
renderToString:
  Server starts: 0ms
  Data fetching: 0-500ms
  Rendering: 500-800ms
  First byte sent: 800ms ← User sees content

renderToPipeableStream:
  Server starts: 0ms
  Shell rendered: 50ms
  First byte sent: 50ms ← User sees skeleton
  Data streams in: 50-800ms ← Progressive content
```

### Impact
- TTFB: 800ms vs target 50-200ms
- Poor perceived performance
- Lower Lighthouse scores

### Mitigation Strategy (Phase 3.3)
```typescript
import { renderToPipeableStream } from 'react-dom/server';

const { pipe } = renderToPipeableStream(<App />, {
  onShellReady() {
    res.setHeader('Content-Type', 'text/html');
    pipe(res); // Send immediately!
  },
  onError(error) {
    console.error(error);
  }
});
```

---

## 6. Error Handling & Monitoring 🟠 HIGH

### Current State
```typescript
catch (error) {
  console.error('Error rendering React component:', error);
  response.status(500).send('Internal Server Error');
}
```

### Missing
- ❌ Error boundaries in React
- ❌ SSR error recovery (fallback to client-side render)
- ❌ Logging/monitoring (Sentry, DataDog)
- ❌ Graceful degradation
- ❌ Health checks
- ❌ Alerting when things break

### Production Scenario
```
Component error in production:
  ❌ User sees generic "Internal Server Error"
  ❌ No way to debug (no error logs)
  ❌ No alerting (team doesn't know about issue)
  ❌ No recovery (page completely broken)
  ❌ Can't reproduce (no request context logged)
```

### Impact
- Can't debug production issues
- No visibility into errors
- Poor user experience
- Long mean time to recovery (MTTR)

### Mitigation Strategy (Phase 2.3)
```typescript
// Sentry integration
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

// React Error Boundary
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

---

## 7. Security Headers ✅ IMPLEMENTED

### Status: Helmet.js with SSR-appropriate CSP configured

Security headers are implemented using Helmet.js v8.1.0:

```typescript
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Required for SSR: Inline scripts for hydration data
          "'unsafe-inline'",
          // For Vite dev server HMR in development
          ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: [
          "'self'",
          // For Vite HMR WebSocket in development
          ...(process.env.NODE_ENV === 'development'
            ? ['ws://localhost:*', 'ws://127.0.0.1:*']
            : []),
        ],
        objectSrc: ["'none'"],
        // Disable upgrade-insecure-requests for localhost development
        ...(process.env.NODE_ENV === 'production'
          ? { upgradeInsecureRequests: [] }
          : { upgradeInsecureRequests: null }),
      },
    },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    } : false,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  }),
);
```

### What's Protected ✅
- ✅ Content Security Policy (CSP) with SSR-appropriate settings
- ✅ Clickjacking protection (X-Frame-Options)
- ✅ MIME-sniffing protection (X-Content-Type-Options)
- ✅ HTTPS enforcement in production (HSTS)
- ✅ Referrer policy configured
- ✅ XSS protection via `serialize-javascript`
- ✅ Environment-aware CSP (dev vs production)

### Known Trade-offs
- ⚠️ CSP uses `'unsafe-inline'` for scripts (required for SSR hydration)
- 🎯 Future: Implement nonce-based CSP for stronger security

### Still Needed 🟡
- ⚠️ No rate limiting
- ⚠️ CORS not configured (may need for API endpoints)
- ⚠️ Error messages could expose stack traces in development

---

## 8. No TypeScript Type Safety for Props 🟡 MEDIUM

### Current State
```typescript
export async function renderComponent(
  componentPath: string,
  props: any = {}, // ❌ 'any' = no type safety
)
```

### Problems
- ❌ Can pass wrong props to components (runtime errors)
- ❌ No autocomplete in controllers
- ❌ Refactoring breaks things silently
- ❌ Type drift between controller and component

### Example Error
```typescript
// Controller
@ReactRender('users/views/user-list')
list() {
  return { user: this.usersService.findAll() }; // Typo: should be 'users'
}

// Component expects
interface Props {
  users: User[]; // Plural!
}

// Runtime error in production:
// Cannot read property 'map' of undefined
```

### Mitigation Strategy (Phase 1.1) ✅ In Progress
```typescript
// Type-safe props
interface PageProps<TData = unknown> {
  data: TData;
  context: RenderContext;
}

// Controller
interface UserListData {
  users: User[];
}

@ReactRender('users/views/user-list')
list(): UserListData { // Type checked!
  return { users: this.usersService.findAll() };
}

// Component
export default function UserList({ data }: PageProps<UserListData>) {
  const { users } = data; // TypeScript knows the type!
}
```

---

## 9. Hard-coded .js Extensions 🟢 LOW

### Current State
```typescript
import HomeView from '../app/views/home.js';
```

### Problems
- ⚠️ Confusing (source files are `.tsx`, not `.js`)
- ⚠️ TypeScript config dependent
- ⚠️ Not portable across bundlers
- ⚠️ If `module` or `moduleResolution` changes → breaks

### Mitigation Strategy (Phase 1.2)
```typescript
// Remove .js extensions
import HomeView from '../app/views/home';

// Let TypeScript resolve
```

---

## 10. No Hydration Mismatch Detection 🟡 MEDIUM

### Problem
If server HTML ≠ client initial render → DOM corruption

### Example
```typescript
// Server renders
<div>Server Time: 10:00:00</div>

// Client hydrates 1 second later
<div>Server Time: 10:00:01</div>

// Result: Hydration mismatch!
```

### Impact
- Subtle bugs (incorrect content displayed)
- Event listeners attached to wrong elements
- React warnings suppressed in production builds

### Mitigation Strategy (Phase 1.6)
```typescript
// Development: Enable StrictMode
<React.StrictMode>
  <App />
</React.StrictMode>

// Catches mismatches during development
```

---

## Deployment Readiness Checklist

### Minimum Viable Production (MVP)
- [x] Production build system working ✅
- [x] Environment-aware bootstrap (dev vs prod) ✅
- [x] TypeScript type safety (no `any`) ✅
- [x] HTTP cache headers for static assets ✅
- [x] Security headers (Helmet.js with CSP) ✅
- [ ] Basic error boundaries
- [ ] Error monitoring (Sentry)
- [ ] Docker support

### Production-Grade
- [ ] Auto-generated view registry (Phase 3.1)
- [ ] Code splitting and optimization (Phase 3.2)
- [ ] Bundle size < 100KB (currently ~202KB client)
- [ ] Lighthouse score > 90
- [ ] HTML response caching (Redis) (Phase 3.4)
- [ ] Streaming SSR (Phase 3.3)
- [ ] CDN integration
- [ ] Health checks and monitoring
- [ ] Rate limiting
- [ ] Automated tests (unit + e2e)
- [ ] Nonce-based CSP (stronger security)

---

## Risk Priority for Open Source

For a successful open-source launch, prioritize in this order:

1. **Auto-generated view registry** (Phase 3.1) - Biggest pain point for users
2. **Production build system** (Phase 2.2) - Must be deployable
3. **Type safety** (Phase 1.1) - Developer experience
4. **Error handling** (Phase 2.3) - Debugging in production
5. **Documentation** - Clear examples and guides

Everything else can be iterative improvements post-launch.
