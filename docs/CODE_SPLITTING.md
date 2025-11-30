# Code Splitting & Optimization

## Overview

The framework implements comprehensive code splitting and optimization strategies to minimize bundle sizes and improve loading performance.

## Automatic Chunk Splitting

### Configuration

The Vite configuration in `vite.config.ts` automatically splits code into optimized chunks:

```typescript
manualChunks: (id) => {
  // Vendor chunk for node_modules
  if (id.includes('node_modules')) {
    // Separate React and React-DOM into their own chunk
    if (id.includes('react') || id.includes('react-dom')) {
      return 'react-vendor';
    }
    // All other dependencies in a vendor chunk
    return 'vendor';
  }
  // View components in separate chunks by module
  if (id.includes('/views/')) {
    const match = id.match(/src\/(.+?)\/views/);
    if (match) {
      return `views-${match[1]}`;
    }
  }
}
```

### Generated Chunks

**Vendor Chunks:**
- `react-vendor.js` - React and React-DOM (~189 KB, gzip: ~59 KB)
- `vendor.js` - Other npm dependencies

**Route-Level Chunks:**
- `views-app.js` - App module views
- `views-users.js` - Users module views
- `views-{module}.js` - Additional module views

**Benefits:**
- **Parallel Downloads**: Browser downloads chunks simultaneously
- **Long-term Caching**: React vendor chunk rarely changes
- **Optimal Loading**: Only required chunks loaded per route
- **Reduced Bandwidth**: Cached chunks not re-downloaded

## Compression

Both Gzip and Brotli compression are generated at build time:

```typescript
// Gzip compression
viteCompression({
  algorithm: 'gzip',
  ext: '.gz',
  deleteOriginFile: false,
}),
// Brotli compression (better compression, modern browsers)
viteCompression({
  algorithm: 'brotliCompress',
  ext: '.br',
  deleteOriginFile: false,
}),
```

**Compression Savings:**
- React vendor: 188.74 KB → 58.97 KB (gzip) → 49.46 KB (brotli)
- 74% reduction with brotli compression

**Server Configuration:**
Your server (Nginx, Express, etc.) should serve `.br` files when the client supports Brotli, falling back to `.gz` for Gzip.

## CSS Optimization

CSS is automatically:
- **Code split** per chunk
- **Minified** using esbuild
- **Extracted** into separate `.css` files with content hashes

```typescript
css: {
  devSourcemap: true, // Sourcemaps in development
},
```

## Bundle Analysis

Generate a visual bundle analysis report:

```bash
pnpm build
```

This creates `dist/stats.html` with:
- Bundle size visualization
- Chunk dependency tree
- Gzip and Brotli sizes
- Module inclusion analysis

Open `dist/stats.html` in a browser to explore the bundle composition.

## Lazy Loading Non-Critical Components

For components not needed on initial render, use the lazy loading utilities:

### Example: Lazy Load Heavy Widget

```tsx
import { lazyLoad } from '@shared/views/lazy-loader';

// Lazy load a heavy chart component
const HeavyChart = lazyLoad(
  () => import('./components/heavy-chart'),
  <div>Loading chart...</div>, // Optional fallback
);

export default function Dashboard({ data }) {
  return (
    <div>
      <h1>Dashboard</h1>
      <HeavyChart data={data} />
    </div>
  );
}
```

### Example: Client-Only Component

```tsx
import { clientOnly } from '@shared/views/lazy-loader';

// Component that uses browser-only APIs
const BrowserMap = clientOnly(
  () => import('./components/map'),
  <div>Map loading...</div>,
);

export default function Location() {
  return (
    <div>
      <h1>Location</h1>
      <BrowserMap coordinates={coords} />
    </div>
  );
}
```

## SSR Considerations

### Why Not React.lazy for Main Views?

In traditional client-side SPAs, React.lazy provides route-level code splitting. However, for SSR with hydration:

1. **Server Requirements**: Server needs synchronous component access
2. **Hydration Matching**: Client must have component immediately to match server HTML
3. **No Lazy Loading on First Load**: Initial page render requires the component

### Our Approach

Instead of React.lazy for main views, we use:
- **Automatic chunk splitting** at build time (Vite/Rollup)
- **Module-based chunks** for organizational benefits
- **Lazy loading** for non-critical components only

This provides the performance benefits of code splitting while maintaining SSR compatibility.

## Performance Targets

Based on the ROADMAP success metrics:

- ✅ **Bundle size < 100KB (gzipped)**: Currently ~64 KB
- ✅ **Optimized vendor splitting**: React isolated for better caching
- ✅ **Content hashing**: Filenames include hash for cache busting
- ✅ **Compression**: Both Gzip and Brotli generated

## Build Configuration Summary

```typescript
// vite.config.ts
{
  build: {
    target: 'es2020',           // Modern browsers for smaller bundles
    minify: 'esbuild',          // Fast minification
    cssMinify: true,            // Minify CSS
    reportCompressedSize: true, // Show gzip sizes in build output
    chunkSizeWarningLimit: 500, // Warn if chunks exceed 500 KB
    manifest: true,             // Generate manifest for SSR
  }
}
```

## Monitoring Bundle Size

Add to your CI/CD pipeline:

```bash
# Build and check bundle sizes
pnpm build

# Check if any chunk exceeds size limit
# (Add custom script in package.json if needed)
```

## Future Optimizations

**Phase 3.3: Streaming SSR** (planned)
- Switch to `renderToPipeableStream`
- Progressive rendering with Suspense
- Reduce Time to First Byte (TTFB)

**Image Optimization** (when needed)
- Automatic image optimization (WebP, AVIF)
- Responsive image srcsets
- Lazy loading images below the fold

**Advanced Techniques:**
- Prefetching critical routes on hover/viewport
- Service Worker for offline caching
- HTTP/2 Server Push for critical assets
