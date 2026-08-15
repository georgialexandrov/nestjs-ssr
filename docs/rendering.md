# Rendering

## Modes

Two rendering modes. Same API.

| Mode   | Method                   | Use Case                           |
| ------ | ------------------------ | ---------------------------------- |
| String | `renderToString`         | Default. Atomic responses, simple. |
| Stream | `renderToPipeableStream` | Advanced. Better TTFB, Suspense.   |

### String Mode (Default)

String mode is the default and recommended for most applications:

- **Atomic responses**: Either complete HTML or error page, never partial
- **Proper HTTP status codes**: 200 for success, 500 for errors
- **Simple error handling**: One try/catch, done
- **Easy debugging**: Full HTML available before sending

```typescript
// Zero config - uses string mode
RenderModule.forRoot();
```

### Stream Mode (Advanced)

Stream mode is available for performance-critical applications:

```typescript
// Opt-in to streaming
RenderModule.forRoot({ mode: 'stream' });
```

**Benefits:**

- Better TTFB (Time to First Byte)
- Progressive rendering with Suspense boundaries
- Lower memory usage for large pages

**Trade-offs:**

- Errors after shell render result in HTTP 200 with partial content
- More complex error handling (shell errors vs streaming errors)
- Requires careful Suspense boundary design

**Use stream mode when:**

- Performance is critical and you've measured TTFB impact
- You're using Suspense for data fetching
- You understand and accept the error handling trade-offs

## @Render Decorator

```typescript
@Get()
@Render(ProductList)
async list() {
  return { products: await this.productService.findAll() };
}
```

The return value is spread directly as the component's props. TypeScript
enforces the match.

## Type Safety

```tsx
interface Props {
  products: Product[];
  totalCount?: number;
}

export default function ProductList({ products }: PageProps<Props>) {
  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}
```

Controller returns wrong shape? Build fails.

## Layouts

Three levels. More specific wins.

**Module-level** — Auto-detected from `views/layout.tsx`:

```tsx
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav>...</nav>
      {children}
    </div>
  );
}
```

**Controller-level:**

```typescript
@Controller('dashboard')
@Layout(DashboardLayout, { props: { showSidebar: true } })
export class DashboardController {}
```

**Method-level:**

```typescript
@Get('settings')
@Render(Settings, {
  layout: SettingsLayout,
  layoutProps: { activeTab: 'general' },
})
async getSettings() {
  return { settings: await this.settingsService.get() };
}
```

Nesting order: root → controller → method → page.

Layouts enable [client-side navigation](/navigation) via segment rendering.

## Head Tags

**Defaults** — via module config, applied to every page:

```typescript
RenderModule.forRoot({
  defaultHead: {
    title: 'My Store',
    ogTitle: 'My Store',
    links: [{ rel: 'icon', href: '/favicon.ico' }],
  },
});
```

**Per-page** — via return value, overriding the defaults:

```typescript
@Get(':id')
@Render(ProductDetail)
async getProduct(@Param('id') id: string) {
  const product = await this.productService.findById(id);
  return {
    product,
    head: {
      title: product.name,
      description: product.description,
      canonical: `https://example.com/products/${product.id}`,
      ogTitle: product.name,
      ogImage: product.imageUrl,
      meta: [{ name: 'author', content: product.brand }],
    },
  };
}
```

Open Graph fields are flat (`ogTitle`, `ogDescription`, `ogImage`) — there is no
nested `og` object. See the [API reference](/api#headdata) for the full list,
including the fields that are declared but not yet rendered.

Return values override decorator defaults.
