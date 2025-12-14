# Configuration

## RenderModule

```typescript
RenderModule.forRoot({
  mode: 'string', // 'string' (default) or 'stream'
  vite: { port: 5173 },
  allowedHeaders: ['accept-language', 'x-request-id'],
  allowedCookies: ['theme', 'locale'],
  defaultHead: {
    title: 'My App',
    meta: [{ name: 'description', content: 'Default description' }],
  },
});
```

| Option           | Default    | Description                                    |
| ---------------- | ---------- | ---------------------------------------------- |
| `mode`           | `'string'` | SSR mode: 'string' (atomic) or 'stream' (TTFB) |
| `vite.port`      | `5173`     | Vite dev server port                           |
| `allowedHeaders` | `[]`       | Headers exposed to client                      |
| `allowedCookies` | `[]`       | Cookies exposed to client                      |
| `defaultHead`    | `{}`       | Default head tags for all pages                |

Per-route `head` overrides these defaults. See [Rendering](/guide/rendering) for mode details.

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
