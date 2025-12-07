# SEO and Meta Tags

This guide shows you how to add SEO meta tags to your server-rendered pages.

## Basic Meta Tags

Include meta tags directly in your component:

```typescript
interface ProductPageProps {
  product: Product;
}

export default function ProductDetail(props: PageProps<ProductPageProps>) {
  const { product } = props;

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <title>{product.name} | Your Store</title>
        <meta name="description" content={product.description} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <div id="root">
          <h1>{product.name}</h1>
        </div>
      </body>
    </html>
  );
}
```

The server renders these tags. Search engines see the complete HTML.

## Dynamic Titles and Descriptions

Pass head metadata from controllers:

```typescript
@Get('/products/:id')
@Render('products/views/product-detail')
async getProduct(@Param('id') id: string) {
  const product = await this.productService.findById(id);

  return {
    product,
    head: {
      title: `${product.name} - ${product.category}`,
      description: product.description.substring(0, 160),
    },
  };
}
```

Use it in the component:

```typescript
interface ProductPageProps {
  product: Product;
}

export default function ProductDetail(props: PageProps<ProductPageProps>) {
  const { product, head } = props;

  return (
    <html>
      <head>
        <title>{head?.title || product.name}</title>
        <meta name="description" content={head?.description || product.description} />
      </head>
      <body>
        <div id="root">
          <h1>{product.name}</h1>
        </div>
      </body>
    </html>
  );
}
```

## Open Graph Tags

Add Open Graph tags for social media:

```typescript
interface ProductPageProps {
  product: Product;
}

export default function ProductDetail(props: PageProps<ProductPageProps>) {
  const { product } = props;

  return (
    <html>
      <head>
        <title>{product.name}</title>
        <meta name="description" content={product.description} />

        {/* Open Graph */}
        <meta property="og:title" content={product.name} />
        <meta property="og:description" content={product.description} />
        <meta property="og:image" content={product.imageUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:url" content={`https://example.com/products/${product.id}`} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={product.name} />
        <meta name="twitter:description" content={product.description} />
        <meta name="twitter:image" content={product.imageUrl} />
      </head>
      <body>
        <div id="root">
          <h1>{product.name}</h1>
        </div>
      </body>
    </html>
  );
}
```

When someone shares your link, social platforms use these tags to generate previews.

## Structured Data

Add JSON-LD structured data:

```typescript
interface ProductPageProps {
  product: Product;
}

export default function ProductDetail(props: PageProps<ProductPageProps>) {
  const { product } = props;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.imageUrl,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "USD",
    },
  };

  return (
    <html>
      <head>
        <title>{product.name}</title>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        <div id="root">
          <h1>{product.name}</h1>
        </div>
      </body>
    </html>
  );
}
```

Search engines use this data to display rich results.

## Canonical URLs

Prevent duplicate content issues:

```typescript
interface ProductPageProps {
  product: Product;
}

export default function ProductDetail(props: PageProps<ProductPageProps>) {
  const { product, context } = props;
  const canonicalUrl = `https://example.com${context.path}`;

  return (
    <html>
      <head>
        <link rel="canonical" href={canonicalUrl} />
      </head>
      <body>
        <div id="root">
          <h1>{product.name}</h1>
        </div>
      </body>
    </html>
  );
}
```

## Reusable Meta Component

Create a component for common meta tags:

```typescript
// components/Meta.tsx
interface MetaProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

export function Meta({ title, description, image, url }: MetaProps) {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      {image && <meta property="og:image" content={image} />}
      {url && <meta property="og:url" content={url} />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
    </>
  );
}
```

Use it in views:

```typescript
import { Meta } from '@/components/Meta';

interface ProductPageProps {
  product: Product;
}

export default function ProductDetail(props: PageProps<ProductPageProps>) {
  const { product } = props;

  return (
    <html>
      <head>
        <Meta
          title={product.name}
          description={product.description}
          image={product.imageUrl}
          url={`https://example.com/products/${product.id}`}
        />
      </head>
      <body>
        <div id="root">
          <h1>{product.name}</h1>
        </div>
      </body>
    </html>
  );
}
```

## Robots Meta Tag

Control indexing:

```typescript
export default function AdminDashboard(props: PageProps) {
  return (
    <html>
      <head>
        <title>Admin Dashboard</title>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>
        <div id="root">
          <h1>Admin Dashboard</h1>
        </div>
      </body>
    </html>
  );
}
```

## Sitemap Generation

Generate sitemaps in a controller:

```typescript
@Controller('sitemap.xml')
export class SitemapController {
  constructor(private productService: ProductService) {}

  @Get()
  @Header('Content-Type', 'text/xml')
  async getSitemap() {
    const products = await this.productService.findAll();

    const urls = products.map(product => `
      <url>
        <loc>https://example.com/products/${product.id}</loc>
        <lastmod>${product.updatedAt.toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>
    `).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${urls}
      </urlset>
    `;
  }
}
```

## Best Practices

**Keep descriptions under 160 characters** - Search engines truncate longer descriptions.

**Use unique titles and descriptions** - Don't duplicate across pages.

**Include relevant keywords** - But avoid keyword stuffing.

**Update Open Graph images** - Use high-quality images (1200x630px recommended).

**Test with tools**:
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)

## Next Steps

- [Core Concepts](/guide/core-concepts) - Understand SSR and hydration
- [Production Deployment](/guide/production) - Deploy your application
- [Troubleshooting](/troubleshooting) - Common issues
