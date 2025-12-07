# Changelog

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
