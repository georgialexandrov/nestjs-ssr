# Head Tags

This guide shows how to add head tags to your pages. Head tags control page titles, meta descriptions, and SEO.

## Basic Usage

Return `head` data from your controller using the `RenderResponse` interface:

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';

@Controller('products')
export class ProductController {
  @Get(':id')
  @Render('views/product-detail')
  async getProduct(@Param('id') id: string) {
    const product = await this.productService.findById(id);

    return {
      props: { product },
      head: {
        title: `${product.name} | Your Store`,
        description: product.description,
      },
    };
  }
}
```

The server renders these tags in the HTML `<head>`. Search engines and browsers see them immediately.

## Available Head Fields

The `head` object supports all common HTML head elements:

```typescript
return {
  props: { product },
  head: {
    // Basic metadata
    title: 'Product Name',
    description: 'Product description for SEO',
    keywords: 'product, ecommerce, shop',
    canonical: 'https://example.com/products/123',

    // Open Graph metadata
    ogTitle: 'Product Name',
    ogDescription: 'Product description for social media',
    ogImage: 'https://example.com/images/product.jpg',

    // Custom meta tags
    meta: [
      { name: 'robots', content: 'index, follow' },
      { name: 'author', content: 'Your Company' },
      { property: 'og:type', content: 'product' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],

    // Link tags (stylesheets, icons, canonical)
    links: [
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'apple-touch-icon', href: '/apple-icon.png' },
    ],

    // Scripts (analytics, tracking)
    scripts: [
      {
        src: 'https://analytics.example.com/script.js',
        async: true,
        defer: true,
      },
    ],

    // JSON-LD structured data
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Product Name',
        description: 'Product description',
      },
    ],

    // HTML and body attributes
    htmlAttributes: { lang: 'en' },
    bodyAttributes: { class: 'product-page' },
  },
};
```

## Dynamic Head Tags

Build head data dynamically based on your application logic:

```typescript
@Get(':id')
@Render('views/product-detail')
async getProduct(@Param('id') id: string) {
  const product = await this.productService.findById(id);

  // Build structured data dynamically
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.imageUrl,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'USD',
    },
  };

  return {
    props: { product },
    head: {
      title: `${product.name} - ${product.category}`,
      description: product.description.substring(0, 160),
      ogTitle: product.name,
      ogDescription: product.description,
      ogImage: product.imageUrl,
      meta: [
        { property: 'og:type', content: 'product' },
        { property: 'product:price:amount', content: product.price },
        { property: 'product:price:currency', content: 'USD' },
      ],
      jsonLd: [structuredData],
    },
  };
}
```

## Social Media Tags

Add Open Graph and Twitter Card tags for rich social media previews:

```typescript
@Get('blog/:slug')
@Render('views/blog-post')
async getBlogPost(@Param('slug') slug: string) {
  const post = await this.blogService.findBySlug(slug);

  return {
    props: { post },
    head: {
      title: post.title,
      description: post.excerpt,

      // Open Graph tags
      ogTitle: post.title,
      ogDescription: post.excerpt,
      ogImage: post.coverImage,

      // Additional Open Graph metadata
      meta: [
        { property: 'og:type', content: 'article' },
        { property: 'article:published_time', content: post.publishedAt },
        { property: 'article:author', content: post.author.name },

        // Twitter Card
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: post.title },
        { name: 'twitter:description', content: post.excerpt },
        { name: 'twitter:image', content: post.coverImage },
      ],
    },
  };
}
```

## Structured Data (JSON-LD)

Add structured data for rich search results:

```typescript
@Get('recipes/:id')
@Render('views/recipe')
async getRecipe(@Param('id') id: string) {
  const recipe = await this.recipeService.findById(id);

  return {
    props: { recipe },
    head: {
      title: `${recipe.name} Recipe`,
      description: recipe.description,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Recipe',
          name: recipe.name,
          description: recipe.description,
          image: recipe.imageUrl,
          author: {
            '@type': 'Person',
            name: recipe.author.name,
          },
          prepTime: `PT${recipe.prepTimeMinutes}M`,
          cookTime: `PT${recipe.cookTimeMinutes}M`,
          recipeYield: `${recipe.servings} servings`,
          recipeIngredient: recipe.ingredients,
          recipeInstructions: recipe.instructions.map((step) => ({
            '@type': 'HowToStep',
            text: step,
          })),
        },
      ],
    },
  };
}
```

## Default Head Configuration

Configure default head tags for all pages in your module:

```typescript
import { Module } from '@nestjs/common';
import { RenderModule } from '@nestjs-ssr/react';

@Module({
  imports: [
    RenderModule.register({
      defaultHead: {
        title: 'My App',
        description: 'Default description for all pages',
        links: [{ rel: 'icon', href: '/favicon.ico' }],
        meta: [
          { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        ],
      },
    }),
  ],
})
export class AppModule {}
```

Individual page `head` data overrides defaults when they have the same property.

## Canonical URLs

Prevent duplicate content issues with canonical URLs:

```typescript
@Get('products/:id')
@Render('views/product-detail')
async getProduct(@Param('id') id: string, @Req() request: Request) {
  const product = await this.productService.findById(id);
  const canonicalUrl = `https://example.com${request.path}`;

  return {
    props: { product },
    head: {
      title: product.name,
      canonical: canonicalUrl,
      links: [
        { rel: 'canonical', href: canonicalUrl },
      ],
    },
  };
}
```

## Controlling Search Indexing

Use the robots meta tag to control search engine indexing:

```typescript
@Get('admin/dashboard')
@Render('views/admin-dashboard')
async getAdminDashboard() {
  return {
    props: { /* dashboard data */ },
    head: {
      title: 'Admin Dashboard',
      meta: [
        { name: 'robots', content: 'noindex, nofollow' },
      ],
    },
  };
}
```

## Multi-language Support

Set language attributes for internationalization:

```typescript
@Get(':lang/products/:id')
@Render('views/product-detail')
async getProduct(
  @Param('lang') lang: string,
  @Param('id') id: string,
) {
  const product = await this.productService.findById(id, lang);

  return {
    props: { product },
    head: {
      title: product.name,
      htmlAttributes: { lang },
      links: [
        // Alternate language versions
        { rel: 'alternate', hreflang: 'en', href: '/en/products/123' },
        { rel: 'alternate', hreflang: 'es', href: '/es/products/123' },
        { rel: 'alternate', hreflang: 'fr', href: '/fr/products/123' },
      ],
    },
  };
}
```

## Analytics and Tracking

Add analytics scripts dynamically:

```typescript
@Get('products/:id')
@Render('views/product-detail')
async getProduct(@Param('id') id: string) {
  const product = await this.productService.findById(id);

  return {
    props: { product },
    head: {
      title: product.name,
      scripts: [
        {
          src: 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID',
          async: true,
        },
        {
          innerHTML: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'GA_MEASUREMENT_ID');
          `,
        },
      ],
    },
  };
}
```

## Best Practices

1. **Keep titles under 60 characters** - Prevents truncation in search results
2. **Keep descriptions under 160 characters** - Optimal for search snippets
3. **Always provide ogImage** - Improves social media sharing
4. **Use structured data** - Enables rich search results
5. **Set canonical URLs** - Prevents duplicate content penalties
6. **Test social cards** - Use tools like [OpenGraph.xyz](https://www.opengraph.xyz/)

## TypeScript Types

For full type safety, use the `HeadData` interface:

```typescript
import { RenderResponse, HeadData } from '@nestjs-ssr/react';

@Get('products/:id')
@Render('views/product-detail')
async getProduct(@Param('id') id: string): Promise<RenderResponse> {
  const product = await this.productService.findById(id);

  const head: HeadData = {
    title: product.name,
    description: product.description,
    ogTitle: product.name,
    ogImage: product.imageUrl,
    meta: [
      { property: 'og:type', content: 'product' },
    ],
  };

  return {
    props: { product },
    head,
  };
}
```

## Next Steps

- [Core Concepts](/guide/core-concepts) - Understand SSR architecture
- [Layouts](/guide/layouts) - Organize pages with layouts
- [API Reference](/reference/api) - Full API documentation
