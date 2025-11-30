# Streaming SSR

This document explains the streaming Server-Side Rendering (SSR) implementation in this library.

## Overview

The library supports two SSR rendering modes:

1. **String Mode** (`renderToString`) - Traditional SSR that returns complete HTML
2. **Stream Mode** (`renderToPipeableStream`) - Modern streaming SSR for better performance

## Why Streaming SSR?

Streaming SSR provides several advantages:

- **Better Time-to-First-Byte (TTFB)**: Start sending HTML before entire React tree is rendered
- **Progressive Rendering**: Browser can start parsing and rendering while React is still generating content
- **Better Perceived Performance**: Users see content sooner
- **React 18+ Suspense Support**: Enables advanced features like selective hydration
- **Foundation for Future**: Prepares codebase for React Server Components (RSC)

## Configuration

### Default (String Mode)

```typescript
// src/app.module.ts
import { RenderModule } from './shared/render/render.module';

@Module({
  imports: [
    RenderModule.register(), // Uses string mode by default
  ],
})
export class AppModule {}
```

### Enable Streaming Mode

#### Option 1: Via Configuration

```typescript
import { RenderModule } from './shared/render/render.module';

@Module({
  imports: [
    RenderModule.register({
      mode: 'stream', // Enable streaming SSR
    }),
  ],
})
export class AppModule {}
```

#### Option 2: Via Environment Variable

```bash
SSR_MODE=stream pnpm start
```

## Custom Error Pages

You can provide custom React components for error pages:

```typescript
// src/custom-error-pages/dev-error.tsx
import type { ErrorPageDevelopmentProps } from '@shared/render/interfaces';

export function CustomDevError({ error, viewPath, phase }: ErrorPageDevelopmentProps) {
  return (
    <html>
      <body>
        <h1>Custom Development Error</h1>
        <p>Error: {error.message}</p>
        <p>View: {viewPath}</p>
        <p>Phase: {phase}</p>
      </body>
    </html>
  );
}
```

```typescript
// src/app.module.ts
import { RenderModule } from './shared/render/render.module';
import { CustomDevError } from './custom-error-pages/dev-error';
import { CustomProdError } from './custom-error-pages/prod-error';

@Module({
  imports: [
    RenderModule.register({
      mode: 'stream',
      errorPageDevelopment: CustomDevError,
      errorPageProduction: CustomProdError,
    }),
  ],
})
export class AppModule {}
```

## How It Works

### String Mode Flow

1. Controller returns data
2. `RenderInterceptor` intercepts response
3. `RenderService.render()` calls `renderToString()`
4. Entire React tree renders to string
5. Template placeholders replaced with HTML, scripts, data
6. Complete HTML returned to client

### Stream Mode Flow

1. Controller returns data
2. `RenderInterceptor` intercepts response
3. `RenderService.render()` calls `renderToStream()`
4. Template parsed into parts (htmlStart, rootStart, rootEnd, htmlEnd)
5. Server module loaded (Vite SSR in dev, built bundle in prod)
6. `renderToPipeableStream()` called with callbacks:
   - **onShellReady**: Write template start + root div start, pipe React stream
   - **onError**: Log errors during streaming (headers already sent)
   - **onAllReady**: Write inline scripts + client scripts + template end
7. HTML streams progressively to client

## Error Handling

Streaming has different error phases:

### Shell Errors (Before Streaming)

Errors that occur before `onShellReady`:
- Can still set HTTP 500 status
- Can send custom error page
- Headers not yet sent

### Stream Errors (During Streaming)

Errors that occur after `onShellReady`:
- Headers already sent (can't change status code)
- Error logged to monitoring
- Partial content already delivered to client
- Client ErrorBoundary should handle gracefully

## Template Structure

The HTML template must have specific markers for streaming:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My App</title>
  <!--initial-state--> <!-- String mode only -->
</head>
<body>
  <div id="root"><!--app-html--></div>
  <!--client-scripts--> <!-- String mode only -->
</body>
</html>
```

For streaming mode, the template is split at these points:
- `htmlStart`: Everything before `<div id="root">`
- `rootStart`: `<div id="root">`
- `rootEnd`: `</div>`
- `htmlEnd`: Everything after `</div>`

## Performance Comparison

### String Mode
- ✅ Simple, proven, easier debugging
- ✅ Complete HTML in single response
- ❌ Blocks until entire React tree rendered
- ❌ Higher TTFB for complex pages

### Stream Mode
- ✅ Better TTFB (send shell immediately)
- ✅ Progressive rendering (faster perceived performance)
- ✅ Enables React Suspense features
- ❌ More complex error handling
- ❌ Headers can't be modified after streaming starts
- ❌ Harder to debug (partial content)

## When to Use Each Mode

### Use String Mode When:
- Simple, fast-rendering pages
- Need to modify headers based on render output
- Debugging SSR issues
- Building a proof-of-concept
- Simpler mental model preferred

### Use Stream Mode When:
- Complex pages with lots of components
- Want better perceived performance
- Using React Suspense
- Large applications where TTFB matters
- Building for production at scale
- Foundation for future RSC adoption

## Security

Both modes include XSS protection:

- **String Mode**: Uses `serialize-javascript` with `isJSON` option
- **Stream Mode**: Uses `safeSerialize()` which escapes dangerous characters:
  - `<` → `\u003c`
  - `>` → `\u003e`
  - `&` → `\u0026`
  - Line/paragraph separators escaped

Error pages also use HTML escaping to prevent XSS in error messages.

## Example: Adding Suspense (Stream Mode Only)

```typescript
import { Suspense } from 'react';

export function MyPage({ data }: PageProps) {
  return (
    <div>
      <h1>My Page</h1>
      <Suspense fallback={<div>Loading comments...</div>}>
        <Comments userId={data.userId} />
      </Suspense>
    </div>
  );
}
```

With streaming SSR:
1. Shell (layout + "Loading comments...") sent immediately
2. `<Comments>` data loads asynchronously
3. Rendered comments streamed when ready
4. Client hydrates progressively

## Debugging

### Enable Debug Logging

```typescript
RenderModule.register({
  mode: 'stream',
  debug: true, // Enable debug logging
})
```

### Check Streaming in Browser

1. Open DevTools Network tab
2. Look for document request
3. Check "Timing" tab - TTFB should be faster with streaming
4. In Response tab, content should arrive progressively

## Migration Guide

### From String to Stream

1. Update configuration:
   ```typescript
   RenderModule.register({ mode: 'stream' })
   ```

2. Test all pages - look for:
   - Errors in server logs
   - Missing content in browser
   - Hydration mismatches (check console)

3. Add Suspense boundaries where beneficial:
   ```typescript
   <Suspense fallback={<Skeleton />}>
     <SlowComponent />
   </Suspense>
   ```

4. Monitor performance:
   - TTFB should improve
   - Watch for streaming errors in logs

### Backwards Compatibility

String mode remains the default for backwards compatibility. Existing applications continue working without changes.

##  Common Issues

### Issue: Hydration Mismatch

**Cause**: Server HTML doesn't match client render

**Solution**:
- Ensure same data on server and client (`window.__INITIAL_STATE__`)
- Avoid browser-only APIs during SSR
- Use `useEffect` for client-only code

### Issue: Headers Already Sent

**Cause**: Trying to set headers/status after streaming started

**Solution**:
- Set headers/cookies before render() in controller
- Use middleware for authentication checks
- Don't modify response in onAllReady callback

### Issue: Error Page Not Showing

**Cause**: Error during streaming (headers sent)

**Solution**:
- Check server logs (error still reported)
- Add client-side ErrorBoundary
- Use onShellError callback for pre-stream errors

## Architecture Diagram

```
Request Flow (Stream Mode):

Controller
    ↓
RenderInterceptor
    ↓
RenderService.render()
    ↓
renderToStream()
    ├─→ TemplateParserService.parseTemplate()
    ├─→ Load SSR module (entry-server.tsx)
    ├─→ renderComponentStream()
    │     ├─→ onShellReady: Write htmlStart + rootStart
    │     ├─→ pipe React stream → response
    │     ├─→ onError: Log to monitoring
    │     └─→ onAllReady: Write scripts + htmlEnd
    └─→ Client receives progressive HTML
```

## Files Changed

- [src/shared/render/interfaces/render-config.interface.ts](../src/shared/render/interfaces/render-config.interface.ts) - Configuration types
- [src/shared/render/template-parser.service.ts](../src/shared/render/template-parser.service.ts) - Template parsing
- [src/shared/render/streaming-error-handler.ts](../src/shared/render/streaming-error-handler.ts) - Error handling
- [src/shared/render/error-pages/error-page-development.tsx](../src/shared/render/error-pages/error-page-development.tsx) - Dev error page
- [src/shared/render/error-pages/error-page-production.tsx](../src/shared/render/error-pages/error-page-production.tsx) - Prod error page
- [src/shared/render/render.service.ts](../src/shared/render/render.service.ts) - Hybrid string/stream rendering
- [src/shared/render/render.interceptor.ts](../src/shared/render/render.interceptor.ts) - Response handling
- [src/shared/render/render.module.ts](../src/shared/render/render.module.ts) - Module registration
- [src/view/entry-server.tsx](../src/view/entry-server.tsx) - Added `renderComponentStream()`

## Further Reading

- [React `renderToPipeableStream` docs](https://react.dev/reference/react-dom/server/renderToPipeableStream)
- [Streaming SSR guide](https://github.com/reactwg/react-18/discussions/37)
- [React Suspense for Data Fetching](https://react.dev/reference/react/Suspense)
