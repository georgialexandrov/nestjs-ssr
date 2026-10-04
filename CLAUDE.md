# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monorepo for `@nestjs-ssr/react` - a React SSR library for NestJS. Controllers return data, React components render views with full TypeScript type safety.

## Commands

### Development

```bash
pnpm install                    # Install dependencies
pnpm build:package              # Build the library
pnpm dev:minimal                # Run minimal example app
```

### Testing

```bash
# In packages/react directory:
pnpm test                       # Unit tests (vitest)
pnpm test:watch                 # Watch mode
pnpm test -- src/render/__tests__/render.service.spec.ts  # Single file

# Integration tests (Playwright)
pnpm test:integration:setup     # Create fixture apps
pnpm test:integration:dev       # Test dev mode (2 fixtures)
pnpm test:integration:prod      # Test production mode
pnpm test:integration:clean     # Remove fixtures
NEST_MAJOR=11 pnpm test:integration:setup  # Fixtures on the Nest 11 CLI

# Example app (Playwright)
EXAMPLE_MODE=prod pnpm test:example   # Route splitting, hydration timing
EXAMPLE_MODE=dev pnpm test:example    # View edit without Nest restart

# Performance
pnpm bench                      # Pipeline micro-benchmark
pnpm perf:http                  # End-to-end SSR CPU per request vs JSON
```

### Build & Quality

```bash
pnpm build                      # Build all packages
pnpm lint                       # ESLint
pnpm typecheck                  # TypeScript check
pnpm docs:dev                   # Local docs server
```

## Architecture

### Monorepo Structure

```
packages/react/          # Main library (@nestjs-ssr/react)
examples/minimal/        # Example app with HMR
docs/                    # VitePress documentation
```

### Library Entry Points

```
@nestjs-ssr/react        # Main: RenderModule, decorators, types
@nestjs-ssr/react/client # Client-only: createSSRHooks, PageContextProvider
@nestjs-ssr/react/render # Internal render services
@nestjs-ssr/react/vite   # Vite plugin: view names, name index for lazy loading
```

The package ships dual ESM + CJS (tsdown). Development-only code
(`src/render/dev/`: Vite dev server and proxy, error-page diagnostics, fresh
view loading) is loaded through `loadDevTools()` and emitted under
`dist/dev/`, outside the core size budget.

### Core Flow

1. **Controller** returns data object with `@Render(Component)` decorator
2. **RenderInterceptor** captures response, builds context, resolves layouts
3. **RenderService** renders component to string or stream
4. **Client hydration** uses `entry-client.tsx` to hydrate with same props

### Key Services (packages/react/src/render/)

- `RenderService` - SSR rendering (string/stream modes), template management
- `RenderInterceptor` - Request interception, context building, layout resolution
- `TemplateParserService` - HTML template parsing, script injection
- `ViteInitializerService` - Dev server proxy setup, production static serving
- `StreamingErrorHandler` - Error handling for streaming SSR
- `src/cli/dev.ts` - `nestjs-ssr dev` runner: restarts Nest only for non-view changes

### SSR Modes

- **string**: `renderToString()` - synchronous, simpler debugging
- **stream**: `renderToPipeableStream()` - better TTFB, Suspense support

### Development Setup

In development, Vite runs as a separate server with HMR support. NestJS proxies asset requests to Vite. The static-file / Vite-proxy handler is installed in `RenderModule.configure()` so it runs ahead of application routes.

Views are identified by component name. The Vite plugin indexes view files by their default export's name (client lazy loading, server preloads); the dev loader (`FreshViews`) does the same from source.

### Layout Hierarchy

Root layout (auto-discovered) → Controller `@Layout()` → Method `@Render(_, { layout })` → Page

### Integration Test Fixtures

Tests create 2 NestJS apps via `nest new` covering SSR modes:

- string - renderToString mode
- stream - renderToPipeableStream mode
- Each tests SSR → hydration → interactivity

## Key Files

- `src/cli/init.ts` - CLI init script that scaffolds user projects
- `src/templates/` - entry-client.tsx, entry-server.tsx, index.html templates
- `src/decorators/` - @Render, @Layout decorators
- `src/interfaces/` - PageProps, RenderContext, HeadData types
- `src/react/hooks/` - createSSRHooks factory for client-side hooks
