# Performance

Optimize your NestJS SSR application for production performance.

## SSR Performance Fundamentals

Server-side rendering has unique performance characteristics. Understanding these helps you optimize effectively.

**Key metrics:**

- **TTFB (Time to First Byte)** - How quickly the server starts sending HTML
- **FCP (First Contentful Paint)** - When users see content
- **TTI (Time to Interactive)** - When the page becomes interactive
- **LCP (Largest Contentful Paint)** - When main content loads

**The SSR timeline:**

```
Request → Controller → Render HTML → Stream HTML → Load JS → Hydrate → Interactive
         └─ TTFB ─────┘            └────── FCP ──────┘        └─ TTI ─┘
```

## Streaming Mode

Use streaming to send HTML progressively as it renders.

**Enable streaming:**

```typescript
// app.module.ts
RenderModule.register({
  mode: 'stream', // Default is 'string'
});
```

**Benefits:**

- **Faster TTFB** - Browser receives HTML immediately
- **Progressive rendering** - Content appears incrementally
- **Better perceived performance** - Users see content sooner
- **Lower memory usage** - No buffering entire HTML string

**String vs Stream comparison:**

```typescript
// String mode - waits for full HTML
mode: 'string';
// Timeline: [====render====][====send====]
// TTFB: Slow (full render time)

// Stream mode - sends HTML as it renders
mode: 'stream';
// Timeline: [====render+send simultaneously====]
// TTFB: Fast (immediate)
```

**When to use:**

- **Stream** - Most production apps (default recommendation)
- **String** - Debugging, need full HTML before sending, simple apps

## Optimize SSR Rendering

Keep server rendering fast by avoiding blocking operations.

### Move Slow Operations Client-Side

Don't block SSR for data that doesn't need to be in initial HTML:

```typescript
// ❌ Slow - blocks SSR for 2 seconds
@Render(Dashboard)
async getDashboard() {
  const stats = await this.slowAnalyticsService.getStats();  // 2s delay
  return { stats };
}

// ✅ Fast - fetch client-side instead
@Render(Dashboard)
getDashboard() {
  return {};  // Render immediately
}

// In React component - fetch after hydration
export default function Dashboard({ data }: PageProps) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats);
  }, []);

  if (!stats) return <Skeleton />;
  return <div>{stats.users} users</div>;
}
```

### Parallel Data Fetching

Fetch data in parallel, not sequentially:

```typescript
// ❌ Slow - sequential fetches (3 seconds total)
@Render(Dashboard)
async getDashboard() {
  const user = await this.userService.getUser();     // 1s
  const posts = await this.postService.getPosts();   // 1s
  const stats = await this.statsService.getStats();  // 1s
  return { user, posts, stats };
}

// ✅ Fast - parallel fetches (1 second total)
@Render(Dashboard)
async getDashboard() {
  const [user, posts, stats] = await Promise.all([
    this.userService.getUser(),     // All run
    this.postService.getPosts(),    // in parallel
    this.statsService.getStats(),
  ]);
  return { user, posts, stats };
}
```

### Cache Expensive Operations

Cache data that doesn't change frequently:

```typescript
@Injectable()
export class DashboardController {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute

  @Get()
  @Render(Dashboard)
  async getDashboard() {
    const cached = this.cache.get('stats');
    const now = Date.now();

    // Return cached if fresh
    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return { stats: cached.data };
    }

    // Fetch and cache
    const stats = await this.statsService.get();
    this.cache.set('stats', { data: stats, timestamp: now });
    return { stats };
  }
}
```

For Redis caching:

```typescript
@Injectable()
export class DashboardController {
  constructor(
    private readonly statsService: StatsService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @Render(Dashboard)
  async getDashboard() {
    // Try cache first
    const cached = await this.redis.get('dashboard:stats');
    if (cached) {
      return { stats: JSON.parse(cached) };
    }

    // Fetch and cache
    const stats = await this.statsService.get();
    await this.redis.set(
      'dashboard:stats',
      JSON.stringify(stats),
      'EX',
      60, // 60 seconds
    );

    return { stats };
  }
}
```

## Bundle Optimization

Minimize JavaScript bundle size for faster loading and hydration.

### Code Splitting

Split large components into separate bundles:

```typescript
import { lazy, Suspense } from 'react';

// Heavy chart library only loads when needed
const Chart = lazy(() => import('./chart'));

export default function Dashboard({ data }: PageProps) {
  return (
    <div>
      <h1>Dashboard</h1>

      <Suspense fallback={<div>Loading chart...</div>}>
        <Chart data={data.stats} />
      </Suspense>
    </div>
  );
}
```

### Tree Shaking

Import only what you need:

```typescript
// ❌ Imports entire library (500KB)
import _ from 'lodash';
const result = _.uniq(array);

// ✅ Imports only uniq function (5KB)
import uniq from 'lodash/uniq';
const result = uniq(array);
```

### Analyze Bundle Size

Use Vite's rollup plugin to analyze bundle size:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
    }),
  ],
});
```

Run build and open `dist/stats.html` to see what's in your bundle.

### Optimize Dependencies

Pre-bundle heavy dependencies:

```typescript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'date-fns', // Heavy date library
    ],
  },
});
```

## Static Asset Optimization

Optimize CSS, images, and other assets.

### CSS Optimization

Vite automatically optimizes CSS in production:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    cssMinify: true, // Minify CSS (default in production)
    cssCodeSplit: true, // Split CSS per route
  },
});
```

### Image Optimization

Use next-gen formats and responsive images:

```typescript
// Use WebP/AVIF for modern browsers
<picture>
  <source srcSet="/hero.avif" type="image/avif" />
  <source srcSet="/hero.webp" type="image/webp" />
  <img src="/hero.jpg" alt="Hero" />
</picture>

// Responsive images
<img
  src="/hero.jpg"
  srcSet="/hero-400.jpg 400w, /hero-800.jpg 800w, /hero-1200.jpg 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  alt="Hero"
/>
```

Consider using an image CDN like Cloudinary or ImageKit for automatic optimization.

### Preload Critical Assets

Preload fonts and critical images:

```typescript
@Render(Home)
getHome() {
  return {
    props: { message: 'Hello' },
    head: {
      links: [
        {
          rel: 'preload',
          href: '/fonts/inter.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: 'anonymous',
        },
        {
          rel: 'preload',
          href: '/images/hero.webp',
          as: 'image',
        },
      ],
    },
  };
}
```

## HTTP Caching

Configure caching headers for static assets.

### Immutable Hashed Assets

Cache hashed assets forever:

```typescript
// main.ts
if (process.env.NODE_ENV === 'production') {
  app.use(
    '/assets',
    express.static('dist/client/assets', {
      setHeaders: (res, path) => {
        // Hashed assets never change
        if (/\.[a-f0-9]{8,}\.(js|css|woff2?)$/.test(path)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
}
```

### HTML Caching

Cache HTML with short TTL and revalidation:

```typescript
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();

        // Cache HTML for 5 minutes, but revalidate
        res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
      }),
    );
  }
}

@Controller()
@UseInterceptors(CacheInterceptor)
export class AppController {
  // Routes automatically get cache headers
}
```

### CDN Caching

Use a CDN for global distribution and caching:

```typescript
// Set cache headers for CDN
@Get()
@Header('Cache-Control', 'public, s-maxage=3600, max-age=300')
@Render(Home)
getHome() {
  return { message: 'Hello' };
}
```

- `s-maxage=3600` - CDN caches for 1 hour
- `max-age=300` - Browser caches for 5 minutes

## Production Build

Optimize your production build configuration.

### Vite Build Settings

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    target: 'es2020', // Modern browsers only
    minify: 'esbuild', // Fast minification
    cssMinify: true,
    cssCodeSplit: true,
    sourcemap: false, // Disable for production
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor bundle
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
```

### NestJS Build Settings

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "declaration": false,
    "removeComments": true,
    "sourceMap": false
  }
}
```

### Environment Variables

Eliminate dead code with build-time environment variables:

```typescript
// vite.config.ts
export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __DEV__: false,
  },
});
```

Then in your code:

```typescript
if (__DEV__) {
  console.log('Debug info'); // Eliminated in production build
}
```

## React Performance

Optimize React rendering and hydration.

### Avoid Unnecessary Re-renders

Use memo for expensive components:

```typescript
import { memo } from 'react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard = memo(function ProductCard({ product }: ProductCardProps) {
  return (
    <div>
      <h2>{product.name}</h2>
      <p>${product.price}</p>
    </div>
  );
});
```

### Optimize Lists

Use proper keys and virtualization for long lists:

```typescript
// ❌ Bad - renders 10,000 items
function ProductList({ products }: { products: Product[] }) {
  return (
    <div>
      {products.map(p => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

// ✅ Good - only renders visible items
import { FixedSizeList } from 'react-window';

function ProductList({ products }: { products: Product[] }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={products.length}
      itemSize={100}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <ProductCard product={products[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

### Lazy Load Below Fold

Defer rendering content below the fold:

```typescript
import { lazy, Suspense } from 'react';

const Reviews = lazy(() => import('./reviews'));
const RelatedProducts = lazy(() => import('./related-products'));

export default function ProductDetail({ data }: PageProps) {
  return (
    <div>
      {/* Above fold - render immediately */}
      <h1>{data.product.name}</h1>
      <img src={data.product.image} alt={data.product.name} />
      <button>Add to Cart</button>

      {/* Below fold - lazy load */}
      <Suspense fallback={<Skeleton />}>
        <Reviews productId={data.product.id} />
      </Suspense>

      <Suspense fallback={<Skeleton />}>
        <RelatedProducts category={data.product.category} />
      </Suspense>
    </div>
  );
}
```

## Monitoring Performance

Measure performance in production to identify bottlenecks.

### Web Vitals

Track Core Web Vitals:

```typescript
// Install: pnpm add web-vitals

// src/views/entry-client.tsx
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric: Metric) {
  fetch('/api/analytics', {
    method: 'POST',
    body: JSON.stringify(metric),
  });
}

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

### Server Monitoring

Track server rendering performance:

```typescript
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const start = Date.now();
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        console.log(`${request.method} ${request.path} - ${duration}ms`);

        // Send to monitoring service
        if (duration > 1000) {
          this.monitoring.recordSlowRender({
            path: request.path,
            duration,
          });
        }
      }),
    );
  }
}
```

### Lighthouse CI

Automate Lighthouse audits in CI:

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm build
      - run: pnpm start & npx wait-on http://localhost:3000
      - uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/products
          uploadArtifacts: true
```

## Common Performance Pitfalls

Avoid these common mistakes.

### Large Initial Bundles

**Problem**: Sending 500KB+ of JavaScript on initial load.

**Solution**: Code split and lazy load:

```typescript
// Split route bundles
const Dashboard = lazy(() => import('./views/dashboard'));
const Settings = lazy(() => import('./views/settings'));

// Split heavy libraries
const Chart = lazy(() => import('./components/chart'));
```

### N+1 Database Queries

**Problem**: Making N queries in a loop instead of one query.

```typescript
// ❌ Bad - N+1 queries
@Render(UserList)
async getUsers() {
  const users = await this.userRepo.findAll();

  // Makes 1 query per user!
  for (const user of users) {
    user.posts = await this.postRepo.findByUserId(user.id);
  }

  return { users };
}

// ✅ Good - single query with join
@Render(UserList)
async getUsers() {
  const users = await this.userRepo.findAll({
    relations: ['posts'],  // Single query with join
  });

  return { users };
}
```

### Memory Leaks

**Problem**: Event listeners not cleaned up, causing memory to grow.

```typescript
// ❌ Bad - listener never removed
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);

// ✅ Good - cleanup on unmount
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### Blocking SSR with Client APIs

**Problem**: Using browser APIs during SSR causes crashes.

```typescript
// ❌ Bad - window not available on server
function Bad() {
  const width = window.innerWidth;  // 💥 Crashes SSR
  return <div>{width}</div>;
}

// ✅ Good - defer to client
function Good() {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    setWidth(window.innerWidth);  // ✅ Only runs in browser
  }, []);

  return <div>{width || 'Loading...'}</div>;
}
```

## Performance Checklist

Use this checklist for production launches:

**Server:**

- [ ] Enable streaming mode (`mode: 'stream'`)
- [ ] Cache expensive database queries
- [ ] Use parallel data fetching (`Promise.all`)
- [ ] Move non-critical data client-side
- [ ] Set up Redis for session/data caching
- [ ] Configure CDN for static assets

**Bundle:**

- [ ] Analyze bundle size (`rollup-plugin-visualizer`)
- [ ] Code split large components (`lazy()`)
- [ ] Tree-shake unused code
- [ ] Use production builds (`NODE_ENV=production`)
- [ ] Minify HTML, CSS, JS
- [ ] Remove console.log and debug code

**Assets:**

- [ ] Optimize images (WebP, responsive sizes)
- [ ] Preload critical fonts and images
- [ ] Set immutable cache headers for hashed assets
- [ ] Use CDN for global distribution
- [ ] Compress responses (gzip/brotli)

**React:**

- [ ] Use `memo()` for expensive components
- [ ] Virtualize long lists (`react-window`)
- [ ] Lazy load below-fold content
- [ ] Avoid prop drilling (use context)
- [ ] Clean up event listeners in `useEffect`

**Monitoring:**

- [ ] Track Core Web Vitals (`web-vitals`)
- [ ] Monitor server response times
- [ ] Set up Lighthouse CI
- [ ] Log slow renders (>500ms)
- [ ] Monitor bundle size in CI

## Next Steps

- [Troubleshooting](/guide/troubleshooting) - Debug performance issues
- [Production Deployment](/guide/production) - Deploy optimized builds
- [Clean Architecture](/guide/clean-architecture) - Structure for scalability
