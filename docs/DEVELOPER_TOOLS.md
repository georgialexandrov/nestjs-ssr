# Developer Tools

This document covers all the developer tools available for debugging and optimizing your SSR application.

## Overview

We leverage existing, battle-tested tools rather than building custom solutions. This gives you:
- **React DevTools** - Component inspection, props, state
- **Vite Plugin Inspect** - Module transformations and dependencies (✅ included)
- **Browser DevTools** - Network, performance, memory profiling
- **SSR Performance Logging** - Server-side rendering metrics (✅ included)
- **react-scan** - Optional performance monitoring (not included by default)

---

## 1. React DevTools (Browser Extension)

**What it does:**
- Inspect component tree, props, state
- Profile component render performance
- Trace component updates
- Debug hooks

**Installation:**
- [Chrome Extension](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- [Firefox Extension](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

**Usage:**
1. Open browser DevTools (F12)
2. Navigate to "Components" or "Profiler" tab
3. Inspect React component tree

**SSR Tips:**
- Components tab shows which components rendered server-side vs client-side
- Look for hydration warnings in console
- Use Profiler to identify slow components

---

## 2. Vite Plugin Inspect

**What it does:**
- Visualize module transformation pipeline
- See how Vite transforms your code
- Inspect module dependencies
- Debug build issues

**Access:** `http://localhost:5173/__inspect/`

**Features:**
- **Modules** - See all loaded modules
- **Transform** - View transformation steps (TypeScript → JavaScript, etc.)
- **Dependency Graph** - Visualize module relationships
- **Plugin Pipeline** - See which Vite plugins transform each file

**When to use:**
- Build is slow - check which transforms are expensive
- Module not found errors - trace import chain
- Understanding code splitting - see chunk boundaries

---

## 3. react-scan (Optional Performance Monitoring)

**What it does:**
- Automatically highlights components that re-render unnecessarily
- Visual overlay showing render performance
- Detects performance issues in real-time

**Status:** NOT included by default (optional, can be added by developers)

**Why not included?**
While react-scan is a great tool, it can cause performance issues on some browsers (especially Safari) and adds extra bundle size. Since this is a library used by many projects, we keep it optional.

**How to add it (if you want it):**

1. Install the package:
```bash
pnpm add -D react-scan
```

2. Add to `src/view/entry-client.tsx` AFTER hydration:
```typescript
hydrateRoot(root, rootElement);
console.log('✅ React hydration complete');

// Optional: Load react-scan for performance monitoring
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    import('react-scan').then(({ scan }) => {
      scan({
        enabled: true,
        log: false, // Set to true for verbose logging
      });
    }).catch((err) => {
      console.warn('Failed to load react-scan:', err);
    });
  }, 0);
}
```

**Usage (if installed):**
- Components that re-render will be highlighted with an overlay
- Frequent re-renders indicate performance issues
- Use React DevTools Profiler to dig deeper

**Note:** Use `setTimeout` to ensure it loads after hydration completes, preventing it from blocking your app's initial interactivity.

---

## 4. Browser DevTools

### Network Tab

**Use for:**
- TTFB (Time to First Byte) measurement
- Waterfall view of resource loading
- Check if streaming SSR is working (progressive HTML delivery)
- Verify cache headers on assets

**SSR-specific checks:**
1. Document request should show:
   - **String mode:** Single HTML response
   - **Stream mode:** Progressive chunks (look at "Timing" → "Content Download")
2. Assets should have cache headers (1 year for hashed files)
3. No 404s for client scripts

### Performance Tab

**Use for:**
- Record page load performance
- See rendering timeline
- Identify layout shifts
- Measure hydration time

**How to measure hydration:**
1. Open Performance tab
2. Start recording
3. Refresh page
4. Stop recording
5. Look for "✅ React hydration complete" marker in console timeline

### Console Tab

**SSR Performance Logs:**
The library automatically logs SSR performance in development:

```
[Nest] [RenderService] [SSR] users/views/user-list rendered in 45ms (string mode)
[Nest] [RenderService] [SSR] users/views/user-profile shell ready in 12ms (stream mode - TTFB)
[Nest] [RenderService] [SSR] users/views/user-profile streaming complete in 52ms total (40ms streaming)
```

**Metrics explained:**
- **String mode:** Total time to render HTML
- **Stream mode - TTFB:** Time until shell is ready (important for perceived performance)
- **Stream mode - total:** Complete rendering time
- **Stream mode - streaming:** Time spent streaming content after shell

---

## 5. Bundle Analysis

**Tool:** rollup-plugin-visualizer

**Access:** After running `pnpm build`, open `dist/stats.html` in a browser

**What it shows:**
- Bundle size breakdown by module
- Which dependencies are largest
- Chunk splitting visualization
- Gzip and Brotli compressed sizes

**How to optimize:**
1. Identify large dependencies
2. Check if they can be lazy-loaded
3. Look for duplicate dependencies
4. Consider code splitting opportunities

---

## 6. React StrictMode (Development)

**Status:** Enabled automatically in development mode

**What it does:**
- Detects unsafe lifecycle methods
- Warns about deprecated APIs
- Double-invokes effects to catch missing cleanup
- Highlights potential problems

**Location:** `src/view/entry-client.tsx`

```typescript
const rootElement = process.env.NODE_ENV === 'development'
  ? <React.StrictMode>{app}</React.StrictMode>
  : app;
```

**Common warnings:**
- **Hydration mismatch:** Server HTML ≠ Client render
- **Missing cleanup:** useEffect without cleanup function
- **Deprecated APIs:** Using old React APIs

---

## Debugging Common Issues

### Hydration Mismatch

**Symptoms:**
- Console warning: "Text content did not match"
- Visual flash on page load
- Components re-render immediately after load

**Debugging steps:**
1. Open React DevTools → Components tab
2. Look for warning icon on components
3. Check console for exact mismatch location
4. Common causes:
   - Using `Date.now()` or `Math.random()` during render
   - Browser-only APIs (window, document) in component body
   - Different data on server vs client

**Fix:**
Use `useEffect` for client-only code:
```typescript
const [isClient, setIsClient] = useState(false);

useEffect(() => {
  setIsClient(true);
}, []);

if (!isClient) {
  return <div>Loading...</div>; // Server render
}

return <div>{window.innerWidth}</div>; // Client only
```

### Slow SSR Performance

**Debugging steps:**
1. Check console logs for render times
2. If > 100ms, investigate:
   - Are you doing data fetching in components? (move to controller)
   - Large component tree? (consider code splitting)
   - Expensive computations? (use `useMemo`)

**Tools to use:**
- Server logs show SSR timing
- React DevTools Profiler (client-side, but hints at server issues)
- Node.js profiler: `node --prof dist/src/main.js`

### Bundle Too Large

**Debugging steps:**
1. Run `pnpm build`
2. Open `dist/stats.html`
3. Identify large dependencies:
   - React vendor chunk should be ~50KB (gzipped)
   - If larger, check for duplicate React versions
4. Look for opportunities to lazy load

**Fix large bundles:**
```typescript
// Before (eager loading)
import HeavyComponent from './heavy-component';

// After (lazy loading)
const HeavyComponent = lazy(() => import('./heavy-component'));

// Use with Suspense
<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

### Unnecessary Re-renders

**Tools:**
1. **react-scan** - Visual overlay shows re-renders
2. **React DevTools Profiler** - Record and analyze renders
3. **Why Did You Render** - Can be added for deeper analysis

**Common causes:**
- Creating new objects/arrays in render
- Missing dependencies in useCallback/useMemo
- Props changing when they shouldn't

**Fix:**
```typescript
// Before (re-renders on every parent render)
<ChildComponent data={[1, 2, 3]} />

// After (stable reference)
const data = useMemo(() => [1, 2, 3], []);
<ChildComponent data={data} />
```

---

## Advanced: Custom Debugging

### Enable Verbose SSR Logging

Temporarily enable detailed logging:

```typescript
// src/shared/render/render.service.ts
// Change this.logger.log(...) to include more details
this.logger.log(`[SSR Details] ${JSON.stringify({
  viewPath,
  mode: this.ssrMode,
  isDevelopment: this.isDevelopment,
  dataSize: JSON.stringify(data).length,
  // ... more context
})}`);
```

### Monitor Memory Usage

```typescript
// Add to entry-server.tsx (development only)
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const usage = process.memoryUsage();
    console.log('Memory:', {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    });
  }, 5000);
}
```

### Add Custom Performance Marks

```typescript
// In your components
useEffect(() => {
  performance.mark('my-component-mounted');
  performance.measure('hydration-to-mount', 'hydration-complete', 'my-component-mounted');

  const measures = performance.getEntriesByName('hydration-to-mount');
  console.log('Time to mount:', measures[0].duration);
}, []);
```

---

## Best Practices

### Development Workflow

1. **Keep DevTools open** - Catch issues immediately
2. **Monitor console** - Watch for warnings and SSR logs
3. **Check Network tab** - Verify streaming, caching, TTFB
4. **Run builds regularly** - Catch bundle size creep early

### Performance Optimization

1. **Baseline metrics first** - Record before optimizing
2. **One change at a time** - Easier to identify what works
3. **Use production builds** - Development is always slower
4. **Test on slow networks** - Simulate real conditions (Chrome DevTools → Network → Slow 3G)

### Before Production

- [ ] No hydration mismatches in console
- [ ] TTFB < 200ms (check Network tab)
- [ ] Bundle size < 100KB gzipped (check `dist/stats.html`)
- [ ] No unnecessary re-renders (check react-scan)
- [ ] All assets have cache headers
- [ ] React DevTools shows no deprecated API warnings

---

## Additional Resources

- [React DevTools Guide](https://react.dev/learn/react-developer-tools)
- [Vite Plugin Inspect Docs](https://github.com/antfu/vite-plugin-inspect)
- [react-scan GitHub](https://github.com/aidenybai/react-scan)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [Web Vitals](https://web.dev/vitals/)

---

## Questions?

If you're stuck debugging an issue:
1. Check console for errors/warnings
2. Use React DevTools to inspect component tree
3. Check Network tab for failed requests
4. Review SSR performance logs
5. Open `dist/stats.html` to analyze bundle

Most SSR issues fall into these categories:
- **Hydration mismatch** → Use browser-only code in useEffect
- **Slow performance** → Move data fetching to controller
- **Large bundles** → Lazy load heavy components
- **Unnecessary re-renders** → Memoize expensive computations
