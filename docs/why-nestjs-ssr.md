# Why NestJS SSR?

## The Problem

NestJS is an excellent framework for building scalable server-side applications. React is the industry-standard library for building user interfaces. But combining them for server-side rendering (SSR) has traditionally been:

- **Complex** - Requires understanding both NestJS and React SSR internals
- **Boilerplate-heavy** - Lots of setup code, configuration, and wiring
- **Opinionated** - Most solutions force you into specific patterns or full frameworks
- **Hard to maintain** - Custom SSR implementations become technical debt

## The Vision

**@nestjs-ssr/react** aims to be the easiest, most unintrusive way to add React SSR to NestJS applications.

### Core Principles

Following the [UnJS philosophy](https://unjs.io/), we built this package with these principles:

#### 1. Unintrusive

The package should integrate seamlessly with existing NestJS applications without forcing major architectural changes.

**What this means:**
- ✅ Works with your existing NestJS setup
- ✅ No need to restructure your application
- ✅ Compatible with existing middleware, guards, interceptors
- ✅ Incremental adoption - add SSR to one route or many
- ❌ Doesn't force you to rewrite your app
- ❌ Doesn't enforce folder structure
- ❌ Doesn't require moving to a full framework

**Example:**
```typescript
// Before: Regular NestJS controller
@Get()
getHome() {
  return { message: 'Hello' };
}

// After: Just add one decorator
@Get()
@Render('views/home')  // That's it!
getHome() {
  return { message: 'Hello' };
}
```

#### 2. Zero-Config with Escape Hatches

It should work out of the box, but allow full customization when needed.

**What this means:**
- ✅ Sensible defaults for 90% of use cases
- ✅ No configuration required to get started
- ✅ Full control when you need it
- ✅ Environment-aware (dev vs production)

**Example:**
```typescript
// Zero config - just works
RenderModule.register()

// But fully customizable when needed
RenderModule.register({
  mode: 'stream',
  errorPageDevelopment: CustomErrorPage,
  errorPageProduction: CustomErrorPage,
})
```

#### 3. Framework Agnostic

The package should focus solely on the SSR layer, without opinions on routing, state management, or application architecture.

**What this means:**
- ✅ Use NestJS routing (no custom router)
- ✅ Bring your own state management
- ✅ Choose your own CSS solution
- ✅ Integrate with any database, API, or service
- ❌ No enforced routing patterns
- ❌ No built-in state management
- ❌ No opinions on app structure

**Why this matters:**
You're building a NestJS app with React views, not a React app with a NestJS backend. The distinction is important.

#### 4. TypeScript First

Full type safety from controller to component.

**What this means:**
- ✅ End-to-end type safety
- ✅ Excellent IDE autocomplete
- ✅ Compile-time error detection
- ✅ Declaration merging for extensibility

**Example:**
```typescript
// Controller
@Render('views/user')
getUser(): UserData {
  return { user: { name: 'John', age: 30 } };
}

// Component - fully typed!
export default function User({ data }: PageProps<UserData>) {
  return <div>{data.user.name}</div>;  // ✅ Type-safe
}
```

#### 5. Production Ready

It should be production-grade from day one, not a toy or proof-of-concept.

**What this means:**
- ✅ Streaming SSR support
- ✅ Code splitting & optimization
- ✅ Error boundaries and monitoring hooks
- ✅ Security headers out of the box
- ✅ Performance optimizations
- ✅ Comprehensive testing infrastructure

## What Makes This Different?

### vs. Next.js

**Next.js** is a full-stack React framework. It's excellent for React-first applications, but:
- Opinionated about routing, data fetching, and architecture
- Can't integrate into existing NestJS apps
- Full framework, not a library
- React Server Components are React-centric

**@nestjs-ssr/react** is a thin SSR layer:
- NestJS-first, React is the view layer
- Integrates with existing apps
- Just a library, not a framework
- Use NestJS for all server logic

**Use Next.js when:** You're building a React-first application
**Use @nestjs-ssr/react when:** You have a NestJS backend and want React views

### vs. Remix

**Remix** is another full-stack framework focused on web standards. Like Next.js:
- Opinionated about routing and data loading
- Can't integrate into existing NestJS apps
- Full framework replacement

**@nestjs-ssr/react:**
- Works with existing NestJS routing
- Adds React views without replacing your backend
- Minimal, focused scope

### vs. Custom SSR Implementation

Many teams roll their own SSR:
- Lots of boilerplate
- Easy to get wrong (memory leaks, performance issues)
- Becomes technical debt
- No community support or updates

**@nestjs-ssr/react:**
- Battle-tested SSR implementation
- Handles edge cases and optimizations
- Community maintained
- Regular updates for React/NestJS compatibility

### vs. Template Engines (Pug, EJS, Handlebars)

Traditional template engines are simpler but limited:
- No component composition
- No React ecosystem (libraries, patterns)
- No client-side interactivity without jQuery/vanilla JS
- Different syntax from modern frontend development

**@nestjs-ssr/react:**
- Full React component model
- Access to entire React ecosystem
- Seamless client-side interactivity
- Modern developer experience

## Use Cases

### Perfect For:

✅ **NestJS apps that need server-rendered UIs**
- Admin dashboards
- Marketing sites
- E-commerce storefronts
- Multi-tenant SaaS applications

✅ **Teams who want SEO + Interactivity**
- Need SEO/meta tags (server rendering)
- Want modern UI with React
- Don't want to maintain separate frontend app

✅ **Incremental Migration**
- Have a NestJS backend
- Want to modernize from template engines
- Can't rewrite everything at once

✅ **Developer Experience**
- Want fast HMR in development
- TypeScript across frontend and backend
- Unified codebase

### Not Ideal For:

❌ **React-first applications**
→ Use Next.js or Remix instead

❌ **Single-page applications (SPAs)**
→ Use Create React App or Vite SPA mode

❌ **Microservices architectures with separate frontend**
→ Keep frontend and backend separate

❌ **Static sites**
→ Use Next.js static export or Gatsby

## Philosophy in Practice

### Example: E-Commerce Application

Imagine you're building an e-commerce site with NestJS. You want:
- Server-rendered product pages (SEO)
- Interactive shopping cart (client-side)
- Admin dashboard
- Checkout flow

**With @nestjs-ssr/react:**

```typescript
// Products Controller
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @Render('products/views/product-list')
  async list(@Query() query: ProductQuery) {
    const products = await this.productsService.findAll(query);
    return { products };
  }

  @Get(':slug')
  @Render('products/views/product-detail')
  async detail(@Param('slug') slug: string) {
    const product = await this.productsService.findBySlug(slug);
    return { product };
  }
}
```

```typescript
// Product Detail View (SSR + Interactive)
export default function ProductDetail({ data }: PageProps<{ product: Product }>) {
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  // Server-rendered for SEO
  return (
    <div>
      <h1>{data.product.name}</h1>
      <p>{data.product.description}</p>
      <meta name="description" content={data.product.description} />

      {/* Client-side interactive */}
      <div>
        <button onClick={() => setQuantity(q => q - 1)}>-</button>
        <span>{quantity}</span>
        <button onClick={() => setQuantity(q => q + 1)}>+</button>
      </div>

      <button onClick={() => {
        addToCart(data.product.id, quantity);
        setAddedToCart(true);
      }}>
        Add to Cart
      </button>

      {addedToCart && <p>Added to cart!</p>}
    </div>
  );
}
```

**What you get:**
- NestJS handles all business logic (products, cart, checkout)
- React handles the view layer (SSR + interactivity)
- SEO-friendly product pages
- Interactive UI without full SPA complexity
- Type-safe end-to-end
- Fast HMR in development

### The NestJS + React Sweet Spot

**NestJS** excels at:
- Business logic & domain models
- Database access & ORMs
- API design & validation
- Background jobs & queues
- Authentication & authorization
- Microservices communication

**React** excels at:
- Component composition
- Interactive UIs
- Rich client-side experiences
- Ecosystem (UI libraries, state management)

**@nestjs-ssr/react bridges them:**
- NestJS controllers return data
- React renders the UI (server + client)
- Clean separation of concerns
- Best of both worlds

## Technical Design Decisions

### Why Vite?

- ⚡ Extremely fast HMR
- 🎯 Modern, unbundled dev server
- 📦 Excellent production builds
- 🔌 Plugin ecosystem
- 💚 Native ESM support

### Why Decorator Pattern?

```typescript
@Render('views/home')
```

- Familiar to NestJS developers
- Non-invasive (works with existing controllers)
- Clear, declarative intent
- Easy to add/remove

### Why Auto-Generated View Registry?

- Zero manual maintenance
- Impossible to forget registering a view
- HMR-friendly
- Scales automatically

### Why Support Both String and Stream SSR?

- **String mode**: Simple, works everywhere, easier to debug
- **Stream mode**: Better performance (TTFB), modern, progressive rendering

Different apps have different needs. We support both.

## Design Trade-offs

### Trade-off 1: Simplicity vs. Features

**Decision:** Simplicity first, features second.

We intentionally kept the API surface small:
- One decorator: `@Render`
- One module: `RenderModule`
- One hook: `usePageContext`

**Rationale:** Easy to learn, hard to misuse. Advanced features can be built on top.

### Trade-off 2: Flexibility vs. Convention

**Decision:** Minimal conventions, maximum flexibility.

We don't enforce:
- Folder structure
- File naming
- Component organization

**Rationale:** NestJS developers already have preferences. Don't force changes.

### Trade-off 3: Bundle Size vs. Features

**Decision:** Lean core with optional modules.

Monitoring is a separate optional module. Future features (i18n, etc.) will be too.

**Rationale:** Most apps don't need everything. Keep the core small.

## The Future

This package represents our vision for NestJS + React SSR. But it's not done. Future directions:

- **Better DX:** More dev tools, better error messages
- **Performance:** Further optimizations, edge deployment
- **Ecosystem:** More integrations (Prisma, GraphQL, etc.)
- **Community:** More examples, patterns, best practices

## Conclusion

**@nestjs-ssr/react** exists because we believe:

1. NestJS is the best framework for building scalable server-side applications
2. React is the best library for building user interfaces
3. Combining them shouldn't be complicated
4. SSR should be a library, not a framework
5. Unintrusive tools are better than opinionated frameworks

If you agree, we'd love for you to try it out. If you don't, that's fine too - use what works best for your use case.

---

**Questions or feedback?** [Open an issue](https://github.com/georgialexandrov/nestjs-ssr/issues) - we'd love to hear from you!