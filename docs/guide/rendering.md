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

Return value becomes `data` prop. TypeScript enforces the match.

## Type Safety

```tsx
interface Props {
  products: Product[];
  totalCount?: number;
}

export default function ProductList({ data }: PageProps<Props>) {
  return (
    <ul>
      {data.products.map((p) => (
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

Layouts enable [client-side navigation](/guide/navigation) via segment rendering.

## Head Tags

**Static** — via decorator:

```typescript
@Render(ProductDetail, {
  head: {
    title: 'Product Details',
    meta: [{ name: 'description', content: 'View product information' }],
    og: { title: 'Product Details', type: 'website' },
  },
})
```

**Dynamic** — via return value:

```typescript
@Get(':id')
@Render(ProductDetail)
async getProduct(@Param('id') id: string) {
  const product = await this.productService.findById(id);
  return {
    product,
    head: {
      title: product.name,
      meta: [{ name: 'description', content: product.description }],
      og: { title: product.name, image: product.imageUrl },
      jsonLd: { '@type': 'Product', name: product.name },
    },
  };
}
```

Return values override decorator defaults.
