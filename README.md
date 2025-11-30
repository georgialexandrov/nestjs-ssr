# @nestjs-ssr/react

> Elegant React SSR for NestJS. Zero-config, fully typed, production-ready.

[![npm version](https://badge.fury.io/js/%40nestjs-ssr%2Freact.svg)](https://www.npmjs.com/package/@nestjs-ssr/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An **unintrusive**, **minimal**, **framework-agnostic** server-side rendering solution for NestJS applications, following the [UnJS philosophy](https://unjs.io/).

## What is This?

This monorepo contains:
- **[@nestjs-ssr/react](./packages/react/)** - The npm package for adding React SSR to NestJS
- **[Examples](./examples/)** - Demonstration applications showing usage patterns
- **[Documentation](./docs/)** - Comprehensive guides and references

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
@ReactRender('views/home')
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

- **[Minimal Example](./examples/minimal/)** - Bare-bones quick start (5 minutes)
- **[Full-Featured Example](./examples/full-featured/)** - Real-world patterns and best practices

### Running Examples

```bash
# Install dependencies
pnpm install

# Run minimal example
pnpm dev:minimal

# Run full-featured example
pnpm dev:full
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
│       │   ├── monitoring/ # Error tracking
│       │   └── index.ts    # Public API
│       ├── package.json
│       └── README.md
│
├── examples/
│   ├── minimal/            # Minimal starter example
│   └── full-featured/      # Complete example app
│
├── docs/                   # Documentation
│   ├── getting-started.md
│   ├── why-nestjs-ssr.md
│   ├── ARCHITECTURE.md
│   └── ...
│
└── README.md               # You are here
```

## Philosophy

This package follows the **UnJS philosophy**:

1. **Unintrusive** - Integrates seamlessly with existing NestJS apps
2. **Zero-Config** - Works out of the box with sensible defaults
3. **Fully Extensible** - Customize everything when needed
4. **Framework Agnostic** - No opinions on routing, state, or business logic
5. **TypeScript First** - Excellent type safety and IDE support

Read more about [why we built this](./docs/why-nestjs-ssr.md).

## Use Cases

Perfect for:
- Admin dashboards and internal tools
- E-commerce storefronts
- Marketing and landing pages
- Multi-tenant SaaS applications
- Any NestJS app that needs SEO + interactivity

## Requirements

- Node.js 18+
- NestJS 11+
- React 19+
- Vite 6+
- TypeScript 5+

## Comparison

### vs. Next.js / Remix
Full-stack frameworks that can't integrate into existing NestJS apps. Great for React-first applications, but @nestjs-ssr/react is better for NestJS-first architectures.

### vs. Template Engines
Traditional template engines (Pug, EJS) lack component composition and modern interactivity. @nestjs-ssr/react gives you the full React ecosystem.

### vs. Custom SSR
Rolling your own SSR is complex and becomes technical debt. This package provides a battle-tested, maintained solution.

See [Why NestJS SSR?](./docs/why-nestjs-ssr.md) for detailed comparisons.

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md).

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/nestjs-ssr.git
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

- [GitHub Issues](https://github.com/yourusername/nestjs-ssr/issues)
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
