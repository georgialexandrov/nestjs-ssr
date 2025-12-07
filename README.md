# @nestjs-ssr/react

> **True Clean Architecture:** React views live alongside NestJS controllers and services—not in a separate framework.

[![npm version](https://badge.fury.io/js/%40nestjs-ssr%2Freact.svg)](https://www.npmjs.com/package/@nestjs-ssr/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Finally, server-side rendering for NestJS that respects your architecture. Add React SSR to existing NestJS apps **without** migrating to Next.js or Remix. Your views stay with your domain logic, your dependency injection works everywhere, and your NestJS modules remain the source of truth.

## What is This?

This monorepo contains:
- **[@nestjs-ssr/react](./packages/react/)** - The npm package for adding React SSR to NestJS
- **[Examples](./examples/)** - Demonstration applications showing usage patterns
- **[Documentation](./docs/)** - Comprehensive guides and references

## Why @nestjs-ssr/react?

### The Architectural Advantage

In Next.js and Remix, **the framework owns your application**. Your business logic adapts to their routing, their data fetching, their deployment model. You can't reuse your existing NestJS services, guards, interceptors, or dependency injection—you're building a separate application.

With **@nestjs-ssr/react**, your **NestJS architecture remains in control**:

```
users/
├── users.controller.ts      # Routes and business logic
├── users.service.ts         # Domain services with DI
├── users.repository.ts      # Data access layer
└── views/
    ├── user-list.tsx        # React SSR view (co-located!)
    └── user-profile.tsx     # Uses same services via DI
```

**This is Clean Architecture:** Views are just another layer. They live with your controllers and services, share the same dependency injection container, and follow the same SOLID principles. No framework boundaries. No duplicate logic. No impedance mismatch.

### When to Choose This Over Next.js/Remix

Choose **@nestjs-ssr/react** if you:
- ✅ Already have a NestJS application with business logic you want to preserve
- ✅ Need SSR for parts of your app (admin dashboards, marketing pages) without migrating everything
- ✅ Want your React views to be a rendering concern, not the application framework
- ✅ Value separation of concerns and Clean Architecture principles
- ✅ Need to share services, guards, and interceptors between REST APIs and SSR routes

Choose **Next.js/Remix** if you:
- 🔄 Are building a new React-first application from scratch
- 🔄 Want the framework to make all architectural decisions for you
- 🔄 Don't need deep integration with existing backend services

## Quick Example

```typescript
// Install
npm install @nestjs-ssr/react react react-dom vite

// Setup (app.module.ts)
@Module({
  imports: [RenderModule.register()],  // Zero config!
})

// Use (controller)
@Get()
@Render('views/home')
getHome() {
  return { message: 'Hello SSR!' };
}

// Render (views/home.tsx)
export default function Home({ data }: PageProps<HomeData>) {
  return <h1>{data.message}</h1>;
}
```

That's it! You now have server-side rendered React in your NestJS app.

## Features

✅ **Zero Configuration** - Works out of the box with sensible defaults
✅ **TypeScript First** - Full type safety from controller to component
✅ **Streaming SSR** - Modern streaming renderToReadableStream support
✅ **HMR in Development** - Powered by Vite for instant feedback
✅ **Production Optimized** - Code splitting, compression, and caching
✅ **Unintrusive** - Integrates seamlessly with existing NestJS apps
✅ **Framework Agnostic** - No opinions on routing, state, or architecture

## Installation

```bash
npm install @nestjs-ssr/react react react-dom vite @vitejs/plugin-react
```

See [Getting Started Guide](./docs/getting-started.md) for detailed setup instructions.

## Documentation

- **[Getting Started](./docs/getting-started.md)** - Step-by-step setup guide
- **[Why NestJS SSR?](./docs/why-nestjs-ssr.md)** - Vision and philosophy
- **[Architecture](./docs/ARCHITECTURE.md)** - How it works under the hood
- **[API Reference](./packages/react/README.md)** - Complete API documentation
- **[Testing Guide](./docs/TESTING_STRATEGY.md)** - How to test SSR applications
- **[Production Deployment](./docs/PRODUCTION_RISKS.md)** - Deployment checklist

## Examples

Explore the examples to see the package in action:

### Getting Started Examples

- **[Minimal Simple](./examples/minimal-simple/)** - Simplest setup with Vite middleware (no HMR)
  - Single server, minimal configuration
  - Perfect for getting started quickly
  - Auto-restart on file changes (requires page refresh)

- **[Minimal](./examples/minimal/)** - Full HMR setup with dual-server architecture
  - Separate Vite dev server with hot module replacement
  - Best developer experience for active development
  - Instant hot reloading without page refresh

### Advanced Example

- **[Full-Featured](./examples/full-featured/)** - Real-world patterns and best practices
  - Production-ready setup with security headers
  - Demonstrates caching, error handling, and more
  - Streaming SSR with React Suspense

### Running Examples

```bash
# Install dependencies
pnpm install

# Run minimal-simple example (simplest setup)
cd examples/minimal-simple && pnpm start:dev

# Run minimal example (with HMR)
cd examples/minimal && pnpm start:dev

# Run full-featured example
cd examples/full-featured && pnpm start:dev
```

## Repository Structure

```
nest-ssr/
├── packages/
│   └── react/              # @nestjs-ssr/react npm package
│       ├── src/
│       │   ├── render/     # Core SSR engine
│       │   ├── react/      # React integration
│       │   ├── vite/       # Vite tooling
│       │   └── index.ts    # Public API
│       ├── package.json
│       └── README.md
│
├── examples/
│   ├── minimal-simple/     # Simplest setup (Vite middleware only)
│   ├── minimal/            # Full HMR setup (dual-server)
│   └── full-featured/      # Production-ready example
│
├── docs/                   # Documentation
│   ├── getting-started.md
│   ├── why-nestjs-ssr.md
│   ├── ARCHITECTURE.md
│   └── ...
│
└── README.md               # You are here
```

## Design Philosophy

### Clean Architecture First

Views are a **presentation layer concern**, not an application framework. This package embraces Clean Architecture principles:

1. **Views co-locate with domain logic** - Your `users/` module contains `users.controller.ts`, `users.service.ts`, and `views/user-list.tsx` together
2. **Dependency injection everywhere** - React views access NestJS services through the same DI container
3. **Single source of truth** - Your NestJS modules define routing, authorization, and data flow—views just render
4. **SOLID principles apply** - Same patterns, same architecture, whether you're building REST APIs or SSR routes

### UnJS Philosophy

Following [UnJS](https://unjs.io/) principles, this package is:

- **Unintrusive** - Integrates seamlessly without requiring architectural changes
- **Zero-Config** - Works out of the box with sensible defaults
- **Fully Extensible** - Customize everything when needed
- **Framework Agnostic** - No opinions about state management or styling
- **TypeScript First** - Excellent type safety and IDE support

Read more about [why we built this](./docs/why-nestjs-ssr.md).

## Use Cases

Perfect for adding SSR to existing NestJS applications:

- **Admin Dashboards** - Your admin panel lives alongside your business logic, shares the same auth guards
- **E-commerce Storefronts** - Product pages use the same `ProductService` as your REST API
- **Marketing Pages** - Landing pages integrate with your existing CMS and analytics services
- **Multi-tenant SaaS** - Tenant-specific views co-locate with tenant business logic
- **Hybrid Applications** - Some routes serve React SSR, others serve REST/GraphQL—all in one codebase

Any scenario where you want **SSR + SEO + interactivity** without abandoning your NestJS architecture.

## Requirements

- Node.js 18+
- NestJS 11+
- React 19+
- Vite 6+
- TypeScript 5+

## Comparison to Alternatives

| Feature | @nestjs-ssr/react | Next.js/Remix | Template Engines | Custom SSR |
|---------|-------------------|---------------|------------------|------------|
| **Integrate with existing NestJS app** | ✅ Yes | ❌ No (separate app) | ✅ Yes | ⚠️ Depends |
| **React component ecosystem** | ✅ Full support | ✅ Full support | ❌ No | ⚠️ DIY |
| **Views co-located with controllers** | ✅ Yes (Clean Architecture) | ❌ No (separate routing) | ✅ Yes | ⚠️ DIY |
| **Share NestJS services via DI** | ✅ Yes | ❌ No | ✅ Yes | ⚠️ DIY |
| **Streaming SSR** | ✅ Yes | ✅ Yes | ❌ No | ⚠️ DIY |
| **Zero config** | ✅ Yes | ⚠️ Opinionated | ✅ Yes | ❌ No |
| **HMR in development** | ✅ Vite | ✅ Yes | ❌ No | ❌ No |
| **TypeScript end-to-end** | ✅ Yes | ✅ Yes | ⚠️ Partial | ⚠️ DIY |
| **Maintenance burden** | ✅ Package handles it | ✅ Framework handles it | ✅ Mature | ❌ Your responsibility |

**Bottom line:** If you value Clean Architecture and already have NestJS business logic, this package lets you add React SSR without compromising your architecture or rewriting your application.

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md).

### Development Setup

```bash
# Clone the repository
git clone https://github.com/georgialexandrov/nestjs-ssr.git
cd nestjs-ssr

# Install dependencies
pnpm install

# Build the package
pnpm build:package

# Run tests
pnpm test

# Run examples
pnpm dev:minimal
pnpm dev:full
```

## License

MIT © Georgi Alexandrov

## Support

- [GitHub Issues](https://github.com/georgialexandrov/nestjs-ssr/issues)
- [Documentation](./docs/)
- [Examples](./examples/)

## Roadmap

- [x] Core SSR functionality
- [x] Streaming SSR support
- [x] Vite integration with HMR
- [x] Auto-generated view registry
- [x] TypeScript types and hooks
- [x] Error monitoring infrastructure
- [x] Comprehensive testing
- [x] Production optimizations
- [x] Detailed documentation
- [ ] npm package publication
- [ ] CLI tooling for scaffolding
- [ ] More examples (i18n, auth, GraphQL)
- [ ] Performance benchmarks
- [ ] Edge deployment support

See [ROADMAP.md](./docs/ROADMAP.md) for detailed progress tracking.

---

**Built with ❤️ for the NestJS and React communities**

If you find this package useful, please consider giving it a ⭐ on GitHub!
