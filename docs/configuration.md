# Configuration

## RenderModule

```typescript
RenderModule.forRoot({
  mode: 'string', // 'string' (default) or 'stream'
  vite: { port: 5173 },
  representation: { json: true },
  allowedHeaders: ['accept-language', 'x-request-id'],
  allowedCookies: ['theme', 'locale'],
  defaultHead: {
    title: 'My App',
    meta: [{ name: 'description', content: 'Default description' }],
  },
});
```

| Option           | Default    | Description                                       |
| ---------------- | ---------- | ------------------------------------------------- |
| `mode`           | `'string'` | SSR mode: 'string' (atomic) or 'stream' (TTFB)    |
| `vite.port`      | `5173`     | Vite dev server port                              |
| `representation` | HTML only  | Representations, limits, deadline, cache, headers |
| `allowedHeaders` | `[]`       | Headers exposed to client, in `context.headers`   |
| `allowedCookies` | `[]`       | Cookies exposed to client, in `context.cookies`   |
| `projectContext` | —          | Narrow the context before it is serialized        |
| `defaultHead`    | `{}`       | Default head tags for all pages                   |
| `jsonApi`        | `false`    | Supported shorthand for `representation.json`     |

Per-route `head` overrides these defaults. See [Rendering](/rendering) for mode details, [Representations](/json-api) for content negotiation, and the [Security model](/security) for what the defaults protect.

## Response policy

The pipeline can apply a cache stance and security headers, and sends none of
them until an application asks — configuring `cache` or `securityHeaders` in
either scope turns the stage on:

```typescript
RenderModule.forRoot({
  representation: {
    cache: { visibility: 'private' },
    securityHeaders: { referrerPolicy: 'no-referrer' },
  },
});
```

That yields `Cache-Control: private, no-store`, `X-Content-Type-Options:
nosniff` and the referrer policy. They remain opt-in. A route opts into public
caching explicitly:

```typescript
@Render(PublicPage, {
  representation: {
    cache: { visibility: 'public', maxAge: 300, keys: ['Accept-Language'] },
  },
})
```

Declared cache keys are combined with the headers negotiation already depends on
(`Accept`, and `X-Current-Layouts` when client navigation is enabled), so `Vary`
stays correct. A header the host application set first is never overwritten.

## Payload limits and deadlines

Client-visible payloads are validated and measured before response headers are
committed. Defaults are 2 MiB and 64 levels of nesting, and `limits.mode` is
`warn` — a violation is logged with its property path and the payload is still
served. Switch to `enforce` once the logs are quiet. `deadlineMs` (falling back
to `timeout`) bounds lazy representation factories, context creation and
projection, layout resolution, and rendering. These asynchronous hooks receive
the same `AbortSignal`. A deadline that expires before the response is committed
returns `503`; one that expires mid-stream aborts the stream without injecting
an error into the partial document.

Routes can only tighten module limits and deadlines. They cannot change an
enforced module limit back to warning mode. To prohibit any route override of a
field, mark it mandatory at module scope:

```typescript
RenderModule.forRoot({
  representation: {
    limits: { mode: 'enforce', maxBytes: 512 * 1024 },
    securityHeaders: { nosniff: true },
    mandatory: ['limits', 'securityHeaders'],
  },
});
```

## Vite

Standard `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
```

Add plugins, configure aliases, adjust build — it's Vite.

## HTML Template

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NestJS React SSR</title>
    <!--head-meta-->
    <!--styles-->
  </head>
  <body>
    <div id="root"><!--app-html--></div>
    <!--initial-state-->
    <!--client-scripts-->
  </body>
</html>
```

Placeholders:

- `<!--head-meta-->` - Dynamic head tags (title, meta, OG)
- `<!--styles-->` - Injected CSS
- `<!--app-html-->` - Server-rendered HTML
- `<!--initial-state-->` - Serialized state for hydration
- `<!--client-scripts-->` - Client bundle script tags
