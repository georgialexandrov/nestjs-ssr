# Head Tags

This guide shows how to add head tags to your pages. Head tags control page titles, meta descriptions, and SEO.

## Basic Usage

Use the `<Head>` component to add tags:

```typescript
import { Head } from '@nestjs-ssr/react';

export default function ProductDetail({ data }: PageProps<{ product: Product }>) {
  return (
    <>
      <Head>
        <title>{data.product.name} | Your Store</title>
        <meta name="description" content={data.product.description} />
      </Head>

      <div>
        <h1>{data.product.name}</h1>
        <p>{data.product.description}</p>
      </div>
    </>
  );
}
```

The server renders these tags in the HTML `<head>`. Search engines and browsers see them immediately.

## Dynamic Tags from Controllers

Pass head metadata from your controller:

```typescript
@Get('/products/:id')
@Render('views/product-detail')
async getProduct(@Param('id') id: string) {
  const product = await this.productService.findById(id);

  return {
    product,
    title: `${product.name} - ${product.category}`,
    description: product.description.substring(0, 160),
  };
}
```

Use in the view:

```typescript
export default function ProductDetail({ data }: PageProps<ProductData>) {
  return (
    <>
      <Head>
        <title>{data.title}</title>
        <meta name="description" content={data.description} />
      </Head>

      <div>
        <h1>{data.product.name}</h1>
      </div>
    </>
  );
}
```

## Open Graph Tags

Add Open Graph tags for social media previews:

```typescript
export default function ProductDetail({ data }: PageProps<{ product: Product }>) {
  return (
    <>
      <Head>
        <title>{data.product.name}</title>
        <meta name="description" content={data.product.description} />

        {/* Open Graph for social media */}
        <meta property="og:title" content={data.product.name} />
        <meta property="og:description" content={data.product.description} />
        <meta property="og:image" content={data.product.imageUrl} />
        <meta property="og:type" content="product" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={data.product.name} />
        <meta name="twitter:image" content={data.product.imageUrl} />
      </Head>

      <div>
        <h1>{data.product.name}</h1>
      </div>
    </>
  );
}
```

## Structured Data

Add JSON-LD for rich search results:

```typescript
export default function ProductDetail({ data }: PageProps<{ product: Product }>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: data.product.name,
    description: data.product.description,
    image: data.product.imageUrl,
    offers: {
      "@type": "Offer",
      price: data.product.price,
      priceCurrency: "USD",
    },
  };

  return (
    <>
      <Head>
        <title>{data.product.name}</title>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </Head>

      <div>
        <h1>{data.product.name}</h1>
      </div>
    </>
  );
}
```

## Default Head Tags

Default head tags are configured in the RenderModule. The built-in template includes common meta tags:

- UTF-8 charset
- Viewport meta tag for responsive design
- Basic SEO-friendly settings

Individual page tags override defaults when they have the same name.

## Canonical URLs

Prevent duplicate content issues:

```typescript
export default function ProductDetail({ data, context }: PageProps<{ product: Product }>) {
  const canonicalUrl = `https://example.com${context.path}`;

  return (
    <>
      <Head>
        <link rel="canonical" href={canonicalUrl} />
      </Head>

      <div>
        <h1>{data.product.name}</h1>
      </div>
    </>
  );
}
```

## Controlling Search Indexing

Use robots meta tag:

```typescript
export default function AdminDashboard({ data }: PageProps) {
  return (
    <>
      <Head>
        <title>Admin Dashboard</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div>
        <h1>Admin Dashboard</h1>
      </div>
    </>
  );
}
```

## Next Steps

- [Core Concepts](/guide/core-concepts) - Understand SSR
- [Development Setup](/guide/development-setup) - Configure HMR
