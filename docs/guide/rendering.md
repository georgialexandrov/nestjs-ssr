# Rendering

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
    <html>
      <body>
        <nav>...</nav>
        {children}
      </body>
    </html>
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
