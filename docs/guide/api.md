# API Reference

## Decorators

### @Render(component, options?)

```typescript
@Render(ProductDetail)
@Render(ProductDetail, { layout: MainLayout })
@Render(ProductDetail, { layout: MainLayout, layoutProps: { nav: true } })
@Render(ProductDetail, { head: { title: 'Product' } })
```

| Option        | Type            | Description      |
| ------------- | --------------- | ---------------- |
| `layout`      | `ComponentType` | Wrapping layout  |
| `layoutProps` | `object`        | Props for layout |
| `head`        | `HeadConfig`    | Head tags        |

### @Layout(component, options?)

```typescript
@Layout(DashboardLayout)
@Layout(DashboardLayout, { props: { sidebar: true } })
```

| Option  | Type     | Description      |
| ------- | -------- | ---------------- |
| `props` | `object` | Props for layout |

## Hooks

| Hook                   | Returns                          |
| ---------------------- | -------------------------------- |
| `useParams<T>()`       | Route parameters                 |
| `useQuery<T>()`        | Query string                     |
| `useHeaders()`         | Filtered headers                 |
| `useSession<T>()`      | Filtered session                 |
| `useRequest()`         | `{ url, method, params, query }` |
| `usePageContext()`     | Full context object              |
| `useNavigationState()` | `'idle'` or `'loading'`          |

## Navigation

### Link

```tsx
import { Link } from '@nestjs-ssr/react/client';

<Link href="/products">Products</Link>
<Link href="/about" replace>About</Link>
<Link href="/settings" scroll={false}>Settings</Link>
```

| Prop      | Type    | Default | Description                    |
| --------- | ------- | ------- | ------------------------------ |
| `href`    | string  | —       | Target URL                     |
| `replace` | boolean | false   | replaceState vs pushState      |
| `scroll`  | boolean | true    | Scroll to top after navigation |

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

```typescript
interface PageProps<T> {
  data: T;
}
```

### HeadConfig

```typescript
interface HeadConfig {
  title?: string;
  meta?: Array<
    { name: string; content: string } | { property: string; content: string }
  >;
  og?: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
    siteName?: string;
  };
  jsonLd?: Record<string, unknown>;
}
```

### RenderModuleOptions

```typescript
interface RenderModuleOptions {
  allowedHeaders?: string[];
  allowedSessionProps?: string[];
  head?: HeadConfig;
}
```
