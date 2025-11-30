# Full-Featured Example

A complete real-world NestJS + React SSR application demonstrating advanced patterns and best practices.

## What This Demonstrates

- Multiple modules (App, Users)
- Shared component library with shadcn/ui
- Context extension for custom data
- Error boundaries and error handling
- Streaming SSR mode
- Code splitting and optimization
- Tailwind CSS integration
- Testing (unit, component, e2e)
- Production deployment patterns

## Key Files to Examine

### Core Setup
- [`src/main.ts`](src/main.ts) - Application bootstrap with security headers
- [`src/app.module.ts`](src/app.module.ts) - Module configuration

### Modules
- [`src/app/`](src/app/) - Home page and app-level features
- [`src/users/`](src/users/) - User CRUD operations

### Shared Components
- [`src/shared/views/`](src/shared/views/) - Reusable UI components
  - Counter (with client-side state)
  - Layout components
  - shadcn/ui components

### View Layer
- [`src/view/entry-server.tsx`](src/view/entry-server.tsx) - Server rendering
- [`src/view/entry-client.tsx`](src/view/entry-client.tsx) - Client hydration
- [`src/view/view-registry.generated.ts`](src/view/view-registry.generated.ts) - Auto-generated registry

## How to Run

```bash
# Install dependencies
pnpm install

# Run in development
pnpm start:dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run tests
pnpm test
```

## What's Different from Minimal

1. **Multiple Modules**: Organized by feature domain
2. **Shared Components**: Reusable UI library with Tailwind CSS
3. **Testing**: Comprehensive test coverage
4. **Production Ready**: Security headers, error handling, optimization
5. **Real-world Patterns**: Demonstrates how to structure a production app

## Architecture Highlights

- **Module Organization**: Each feature is a self-contained NestJS module
- **View Co-location**: Views live next to their controllers
- **Shared Library**: Common components in `src/shared/views/`
- **Type Safety**: End-to-end TypeScript with proper types
- **Auto-Discovery**: Views are automatically registered via Vite plugin

## Testing

```bash
# Unit tests (NestJS services/controllers)
pnpm test:unit

# Component tests (React components)
pnpm test:components

# E2E tests (full app flows)
pnpm test:e2e
```

## Production Deployment

This example includes:
- Optimized builds with code splitting
- Security headers (Helmet.js)
- Error monitoring integration points
- Environment-aware configuration
- Asset compression (gzip/brotli)

See [`docs/PRODUCTION_RISKS.md`](../../docs/PRODUCTION_RISKS.md) for deployment checklist.
