# Configuration

## RenderModule

```typescript
RenderModule.forRoot({
  allowedHeaders: ['accept-language', 'x-request-id'],
  allowedSessionProps: ['theme', 'locale', 'currency'],
  head: {
    title: 'My App',
    meta: [{ name: 'description', content: 'Default description' }],
    og: { siteName: 'My App', type: 'website' },
  },
});
```

| Option                | Default | Description                     |
| --------------------- | ------- | ------------------------------- |
| `allowedHeaders`      | `[]`    | Headers exposed to client       |
| `allowedSessionProps` | `[]`    | Session props exposed to client |
| `head`                | `{}`    | Default head tags               |

Per-route `head` overrides these defaults.

## Vite

Standard `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nestjsSsr } from '@nestjs-ssr/react/vite';

export default defineConfig({
  plugins: [react(), nestjsSsr()],
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
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!--head-->
  </head>
  <body>
    <div id="root"><!--ssr--></div>
    <script type="module" src="/src/entry-client.tsx"></script>
  </body>
</html>
```

`<!--head-->` = head tags. `<!--ssr-->` = rendered HTML.
