# API Reference

## Decorators

### @Render(component, options?)

```typescript
@Render(ProductDetail)
@Render(ProductDetail, { layout: MainLayout })
@Render(ProductDetail, { layout: MainLayout, layoutProps: { nav: true } })
@Render(ProductDetail, { layout: false })  // skip controller layout, keep root
@Render(ProductDetail, { layout: null })   // skip all layouts
@Render(ProductDetail, { jsonApi: true })
```

| Option        | Type                               | Description                         |
| ------------- | ---------------------------------- | ----------------------------------- |
| `layout`      | `LayoutComponent \| false \| null` | Layout override — see below         |
| `layoutProps` | `object`                           | Props for layout                    |
| `jsonApi`     | `boolean`                          | Override module-level JSON API mode |

`layout` semantics: a component replaces the controller layout, `false` skips the
controller layout but keeps the root layout, `null` skips all layouts, and
`undefined` (omitted) inherits the controller layout.

Head data is **not** a `@Render` option — set defaults via `defaultHead` on
`RenderModule.forRoot()`, and per-page values by returning `head` from the
controller.

### @Layout(component, options?)

```typescript
@Layout(DashboardLayout)
@Layout(DashboardLayout, { props: { sidebar: true } })
```

| Option  | Type     | Description      |
| ------- | -------- | ---------------- |
| `props` | `object` | Props for layout |

## Hooks

Import from `@nestjs-ssr/react/client` (or `@nestjs-ssr/react` on the server).

| Hook                   | Returns                               |
| ---------------------- | ------------------------------------- |
| `usePageContext<T>()`  | Full context object                   |
| `useRequest<T>()`      | Alias for `usePageContext()`          |
| `useParams()`          | `Record<string, string>`              |
| `useQuery()`           | `Record<string, string \| string[]>`  |
| `useHeaders()`         | Headers opted in via `allowedHeaders` |
| `useHeader(name)`      | `string \| undefined`                 |
| `useCookies()`         | Cookies opted in via `allowedCookies` |
| `useCookie(name)`      | `string \| undefined`                 |
| `useNavigationState()` | `'idle'` or `'loading'`               |
| `useIsNavigating()`    | `boolean`                             |
| `useNavigate()`        | `(href, options?) => Promise<void>`   |
| `useNavigation()`      | `{ state, navigate }`                 |

Headers and cookies are **opt-in only** — nothing is exposed to the client until
you list it in `allowedHeaders` / `allowedCookies` on `RenderModule.forRoot()`.

### createSSRHooks\<T\>()

Creates hooks bound to your own extended context type, so you don't pass a
generic at every call site.

```typescript
// src/lib/ssr-hooks.ts
import { createSSRHooks, RenderContext } from '@nestjs-ssr/react';

interface AppRenderContext extends RenderContext {
  user?: { id: string; name: string };
}

export const { usePageContext, useParams, useCookie } =
  createSSRHooks<AppRenderContext>();
```

```tsx
// src/views/home.tsx
import { usePageContext } from '@/lib/ssr-hooks';

export default function Home() {
  const { user } = usePageContext(); // fully typed
  return <h1>Welcome {user?.name}</h1>;
}
```

## Navigation

### Link

```tsx
import { Link } from '@nestjs-ssr/react/client';

<Link href="/products">Products</Link>
<Link href="/about" replace>About</Link>
<Link href="/settings" scroll={false}>Settings</Link>
```

`LinkProps` extends `React.AnchorHTMLAttributes<HTMLAnchorElement>`, so any
anchor attribute (`className`, `target`, `aria-*`, …) is accepted.

| Prop      | Type    | Default | Description                    |
| --------- | ------- | ------- | ------------------------------ |
| `href`    | string  | —       | Target URL                     |
| `replace` | boolean | false   | replaceState vs pushState      |
| `scroll`  | boolean | true    | Scroll to top after navigation |

Falls back to a normal browser navigation for external origins, modified clicks
(ctrl/cmd/shift/alt), middle-clicks, and `target="_blank"`.

### navigate()

```typescript
import { navigate } from '@nestjs-ssr/react/client';

await navigate('/dashboard');
await navigate('/settings', { replace: true, scroll: false });
```

| Option    | Type    | Default | Description                    |
| --------- | ------- | ------- | ------------------------------ |
| `replace` | boolean | false   | replaceState vs pushState      |
| `scroll`  | boolean | true    | Scroll to top after navigation |

## Types

### PageProps\<T\>

Controller data is spread directly as component props — there is no `data`
wrapper. `head` is merged in as an optional extra prop.

```typescript
type PageProps<TProps = {}> = TProps & {
  head?: HeadData;
};
```

```tsx
interface ProductPageProps {
  product: Product;
  related: Product[];
}

export default function ProductDetail({
  product,
  related,
  head,
}: PageProps<ProductPageProps>) {
  /* … */
}
```

### HeadData

Returned as `head` from a controller, or set globally as `defaultHead`.
All Open Graph fields are **flat** (`ogTitle`, not `og.title`).

```typescript
interface HeadData {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  links?: Array<{
    rel: string;
    href: string;
    as?: string;
    type?: string;
    integrity?: string;
    crossorigin?: string;
    referrerpolicy?: string;
  }>;
  meta?: Array<{
    name?: string;
    property?: string;
    content?: string;
    charset?: string;
  }>;
}
```

Values are HTML-escaped on render. Attributes are selected from element-specific
allowlists; executable event attributes such as `onload` and `onerror` are
discarded.

::: warning Not yet implemented
The `HeadData` type also declares `scripts`, `jsonLd`, `htmlAttributes`, and
`bodyAttributes`. These are **not rendered** by any current renderer — setting
them has no effect. They are tracked for a future release; don't rely on them.
:::

### RenderResponse\<T\>

Controllers may return a plain object (auto-wrapped as `props`) or the explicit
shape:

```typescript
interface RenderResponse<T = any> {
  props: T;
  head?: HeadData;
  layoutProps?: Record<string, any>;
}
```

## RenderModule.forRoot(config?)

`RenderConfig` — every option is optional.

| Option                 | Type                                        | Default          | Description                                                            |
| ---------------------- | ------------------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| `mode`                 | `'string' \| 'stream'`                      | `'string'`       | `renderToString` vs `renderToPipeableStream`                           |
| `project`              | `string`                                    | auto             | Nest CLI project name in a monorepo workspace                          |
| `viewsDir`             | `string`                                    | `views`          | Override the views directory, relative to the project root or absolute |
| `environment`          | `'development' \| 'production'`             | from `NODE_ENV`  | Explicit override; takes precedence over `NODE_ENV`                    |
| `timeout`              | `number`                                    | `10000`          | Maximum SSR render duration in milliseconds                            |
| `vite`                 | `{ port?, allowedHosts?, allowedOrigins? }` | `{ port: 5173 }` | Dev server and explicit remote proxy allowlists                        |
| `template`             | `string`                                    | built-in         | Custom HTML template — file path or template string                    |
| `defaultHead`          | `HeadData`                                  | —                | Default head data for all pages; per-page `head` overrides it          |
| `allowedHeaders`       | `string[]`                                  | `[]`             | Request headers exposed to the client                                  |
| `allowedCookies`       | `string[]`                                  | `[]`             | Cookies exposed to the client                                          |
| `context`              | `ContextFactory`                            | —                | Per-request factory merged into `RenderContext`                        |
| `cspNonce`             | `CspNonceFactory`                           | —                | Per-request nonce applied to all injected script tags                  |
| `jsonApi`              | `boolean`                                   | `false`          | Respond with JSON when `Accept: application/json`                      |
| `clientNavigation`     | `boolean`                                   | `true`           | Serve JSON segment responses for `<Link>` navigation                   |
| `errorPageDevelopment` | `ComponentType<ErrorPageDevelopmentProps>`  | built-in         | Custom dev error page                                                  |
| `errorPageProduction`  | `ComponentType`                             | built-in         | Custom production error page                                           |

### Environment detection

Development mode is opt-in. `environment` wins when set; otherwise development
requires `NODE_ENV=development` exactly. Anything else — `production`, `test`,
or unset — runs the production pipeline.

This is deliberate. Development mode installs a proxy to the Vite dev server
(which serves project sources, including Vite's `/@fs/` file endpoint) and
renders error pages containing stack traces. A deployment that forgets to set
`NODE_ENV` gets neither.

The `init` CLI writes `NODE_ENV=development` into the generated `dev:nest`
script. Projects that predate it need to add it:

```json
{
  "scripts": {
    "dev:nest": "NODE_ENV=development nest start --watch --watchAssets --preserveWatchOutput"
  }
}
```

### `vite.allowedHosts` and `vite.allowedOrigins`

The dev proxy only serves loopback clients. Requests from any other address
fall through to the application, and off-machine Vite WebSocket handshakes are
dropped — otherwise NestJS (which binds every interface) would republish a
dev server that Vite deliberately binds to localhost only.

For a browser on another host, add its exact hostname to `allowedHosts` and its
exact HTTP(S) origin (including port) to `allowedOrigins`. Both must match.
Host, Origin, peer address, and forwarding headers are validated to resist DNS
rebinding and accidental exposure through a local reverse proxy. Prefer an SSH
tunnel where you can. These options have no effect in production.

### Monorepo workspaces

SSR paths are resolved from `nest-cli.json`. In a single-app workspace nothing
needs configuring. In a monorepo, each app resolves against its own project root,
so views, the dev entries, and `dist/client` / `dist/server` are found per app
rather than relative to the directory the process happens to start in.

The active project is resolved in this order:

1. `project` passed to `RenderModule.forRoot()`
2. the `NEST_SSR_PROJECT` environment variable
3. the path of the running main file
4. the default project in `nest-cli.json`

```typescript
// apps/web/src/app.module.ts
RenderModule.forRoot({ project: 'web' });
```

Set `viewsDir` when the views live somewhere other than `<sourceRoot>/views`:

```typescript
RenderModule.forRoot({ project: 'web', viewsDir: 'src/ui/pages' });
```

The embedded SSR server loads the same `vite.config` your client build uses, so
plugins, aliases, and `define` values apply to both halves of the render.

### context factory

```typescript
RenderModule.forRoot({
  context: ({ req }) => ({ user: req.user }),
});

// async, with injected services
RenderModule.forRootAsync({
  imports: [PermissionModule],
  inject: [PermissionService],
  useFactory: (permissions: PermissionService) => ({
    context: async ({ req }) => ({
      user: req.user,
      permissions: await permissions.getForUser(req.user),
    }),
  }),
});
```

### cspNonce factory

```typescript
RenderModule.forRoot({
  cspNonce: ({ req }) => (req as any).res?.locals?.cspNonce,
});
```
