# @nestjs-ssr/react

[![npm version](https://badge.fury.io/js/%40nestjs-ssr%2Freact.svg)](https://www.npmjs.com/package/@nestjs-ssr/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

React server-side rendering for NestJS. Add React SSR to existing NestJS applications while preserving Clean Architecture principles.

**[Documentation](https://georgialexandrov.github.io/nest-ssr/)** | **[Getting Started](https://georgialexandrov.github.io/nest-ssr/guide/getting-started)** | **[Examples](./examples/)**

## What is This?

React rendering for NestJS applications. Controllers handle routing and business logic, services manage data, and React components render views. Each layer stays separate.

```typescript
// Install
npm install @nestjs-ssr/react react react-dom vite

// Setup (app.module.ts)
@Module({
  imports: [RenderModule.register()],
})

// Controller
@Get()
@Render('views/home')
getHome() {
  return { message: 'Hello SSR' };
}

// View (views/home.tsx)
export default function Home({ data }: PageProps<HomeData>) {
  return <h1>{data.message}</h1>;
}
```

## Monorepo Contents

- **[@nestjs-ssr/react](./packages/react/)** - The npm package
- **[Examples](./examples/)** - Working applications
- **[Documentation](https://georgialexandrov.github.io/nest-ssr/)** - Complete guides and API reference

## Why This Library?

NestJS follows a pattern: controllers define routes, services contain business logic, modules organize features. This library continues that pattern. React components become views that live alongside controllers and services.

The view layer stays separate from business logic. Controllers return data. Services manage state. React components render. Each layer tests independently.

**Use this library when:**
- You have an existing NestJS application that needs server-rendered views
- You want to add React SSR without restructuring your backend
- You prefer explicit routing over file-based conventions
- You value architectural separation and testability

## Features

- Zero configuration with sensible defaults
- Full TypeScript support
- Streaming SSR
- Hot Module Replacement in development
- Production optimizations (code splitting, caching)
- Integrates with existing NestJS apps
- No opinions on routing, state, or styling

## Documentation

Read the full documentation at **[georgialexandrov.github.io/nest-ssr](https://georgialexandrov.github.io/nest-ssr/)**

- [Getting Started](https://georgialexandrov.github.io/nest-ssr/guide/getting-started)
- [Core Concepts](https://georgialexandrov.github.io/nest-ssr/guide/core-concepts)
- [Forms and Data](https://georgialexandrov.github.io/nest-ssr/guide/forms-and-data)
- [Production Deployment](https://georgialexandrov.github.io/nest-ssr/guide/production)
- [API Reference](https://georgialexandrov.github.io/nest-ssr/reference/api)
- [Troubleshooting](https://georgialexandrov.github.io/nest-ssr/troubleshooting)

## Examples

### Minimal
Simplest setup with embedded Vite mode and full HMR support. Single server process.

```bash
cd examples/minimal && pnpm start:dev
```

### Minimal HMR
Advanced HMR setup with dual-server architecture for optimal development experience.

```bash
cd examples/minimal-hmr && pnpm start:dev
```

### Full-Featured
Production-ready example with security headers, caching, and streaming SSR.

```bash
cd examples/full-featured && pnpm start:dev
```

## Design Philosophy

**NestJS Patterns**: Continues NestJS conventions - decorators for routing (`@Render` follows `@Get`, `@Post`), modules for organization, dependency injection for services. Views integrate without disrupting existing patterns.

**Architectural Separation**: Views are presentation. Controllers orchestrate. Services contain business logic. Each layer has clear responsibilities and tests independently.

## Requirements

- Node.js 18+
- NestJS 11+
- React 19+
- Vite 6+
- TypeScript 5+

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
git clone https://github.com/georgialexandrov/nestjs-ssr.git
cd nestjs-ssr
pnpm install
pnpm build:package
pnpm test
```

## License

MIT © Georgi Alexandrov
