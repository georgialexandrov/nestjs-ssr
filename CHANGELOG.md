# Changelog

## v0.1.12

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.1.11...v0.1.12)

### 📖 Documentation

- Add preview notice to package README ([8650f29](https://github.com/georgialexandrov/nestjs-ssr/commit/8650f29))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.1.11

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.1.10...v0.1.11)

### 🩹 Fixes

- Restore entry file filter and add preview notice ([65a4a9c](https://github.com/georgialexandrov/nestjs-ssr/commit/65a4a9c))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.1.10

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.1.9...v0.1.10)

### 🚀 Enhancements

- Add global types export and improve TypeScript configuration ([b3a2c1f](https://github.com/georgialexandrov/nestjs-ssr/commit/b3a2c1f))
- Update examples with new TypeScript configuration ([21fa929](https://github.com/georgialexandrov/nestjs-ssr/commit/21fa929))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.1.9

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.1.7...v0.1.9)

### 🚀 Enhancements

- Add CLI tool and migrate entry files to views directory ([e7963df](https://github.com/georgialexandrov/nestjs-ssr/commit/e7963df))
- Add automatic dependency installation to CLI and improve workflows ([67a3fa4](https://github.com/georgialexandrov/nestjs-ssr/commit/67a3fa4))

### 🩹 Fixes

- Correct VitePress base path for GitHub Pages ([8f9728a](https://github.com/georgialexandrov/nestjs-ssr/commit/8f9728a))
- Release 0.1.9 ([6c8ddcf](https://github.com/georgialexandrov/nestjs-ssr/commit/6c8ddcf))
- Changelogen should run from packages/react directory ([a4bf55a](https://github.com/georgialexandrov/nestjs-ssr/commit/a4bf55a))

### 🏡 Chore

- Remove unused Vite plugin and upgrade to pnpm 10 ([c030a59](https://github.com/georgialexandrov/nestjs-ssr/commit/c030a59))
- Release v0.1.8 ([0cd2e1c](https://github.com/georgialexandrov/nestjs-ssr/commit/0cd2e1c))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.1.0 (2025-12-07)

🎉 **Initial release of @nestjs-ssr/react** - True Clean Architecture for React SSR in NestJS.

### ✨ Features

**Core SSR Engine:**
- ✅ Server-side rendering with React 19
- ✅ Streaming SSR with React Suspense
- ✅ Client-side hydration
- ✅ Full TypeScript type safety end-to-end
- ✅ Request context hooks (usePageContext, useParams, useQuery, etc.)

**Developer Experience:**
- ✅ Zero-config setup with sensible defaults
- ✅ Hot Module Replacement (HMR) with Vite
- ✅ Auto-generated view registry (no manual imports)
- ✅ Type-safe view paths with IDE autocomplete
- ✅ Environment-aware bootstrap (dev vs. production)

**Production Ready:**
- ✅ XSS protection with serialize-javascript
- ✅ Security headers with Helmet.js integration
- ✅ HTTP caching for static assets
- ✅ Code splitting and optimization
- ✅ Error boundaries for graceful degradation
- ✅ Streaming error handling with custom error pages

**Testing:**
- ✅ Comprehensive unit tests (129 passing tests)
- ✅ Vitest test infrastructure
- ✅ Full test coverage for core services

**Documentation:**
- ✅ Comprehensive README with Clean Architecture value proposition
- ✅ Getting started guide
- ✅ Tutorial guides (First Page, Forms & Data, Deployment, Next.js Migration)
- ✅ Architecture documentation
- ✅ Security best practices
- ✅ Three example applications

**Examples:**
- ✅ Minimal (full HMR setup)
- ✅ Minimal Simple (single-server Vite)
- ✅ Full-Featured (production patterns)

### 📦 Package

- Package name: `@nestjs-ssr/react`
- License: MIT
- Peer dependencies: NestJS 11+, React 19+, Vite 6+

### 🏗️ Clean Architecture

The defining feature of @nestjs-ssr/react is its architectural philosophy:

- **Views co-locate with controllers** - No framework separation
- **Dependency injection everywhere** - Services shared between API and SSR
- **NestJS as source of truth** - Routing, guards, interceptors apply to SSR
- **SOLID principles** - Same patterns for REST API and SSR routes

Unlike Next.js/Remix where the framework owns your app, @nestjs-ssr/react lets React be just the view layer while NestJS handles everything else.

### 🙏 Contributors

- Georgi Alexandrov ([@georgialexandrov](https://github.com/georgialexandrov))
- Claude Code

---

**Ready to use?** `npm install @nestjs-ssr/react react react-dom vite @vitejs/plugin-react`

**Questions?** Open an issue at https://github.com/georgialexandrov/nestjs-ssr/issues
