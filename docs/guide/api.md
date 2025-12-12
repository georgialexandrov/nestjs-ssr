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

| Hook               | Returns                          |
| ------------------ | -------------------------------- |
| `useParams<T>()`   | Route parameters                 |
| `useQuery<T>()`    | Query string                     |
| `useHeaders()`     | Filtered headers                 |
| `useSession<T>()`  | Filtered session                 |
| `useRequest()`     | `{ url, method, params, query }` |
| `usePageContext()` | Full context object              |

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
