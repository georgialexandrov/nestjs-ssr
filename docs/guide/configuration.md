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

- `<!--styles-->` - Injected CSS and head tags
- `<!--app-html-->` - Server-rendered HTML
- `<!--initial-state-->` - Serialized state for hydration
- `<!--client-scripts-->` - Client bundle script tags
