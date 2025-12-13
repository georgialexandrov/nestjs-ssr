# Changelog

## v0.2.3

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.2.2...v0.2.3)

### 📖 Documentation

- Add AI context files (CLAUDE.md, llms.txt) ([5cb0e2d](https://github.com/georgialexandrov/nestjs-ssr/commit/5cb0e2d))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.2.2

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.2.1...v0.2.2)

### 🩹 Fixes

- **ssr:** Fix string mode rendering loop and complete SSR implementation ([f1fd241](https://github.com/georgialexandrov/nestjs-ssr/commit/f1fd241))
- **streaming:** Fix stream mode response completion ([f73e764](https://github.com/georgialexandrov/nestjs-ssr/commit/f73e764))
- **cli:** Add graceful shutdown and auto-configure main.ts and app.module.ts ([aaf02fd](https://github.com/georgialexandrov/nestjs-ssr/commit/aaf02fd))
- **streaming:** Fix stream mode response completion and add integration tests ([165d0f0](https://github.com/georgialexandrov/nestjs-ssr/commit/165d0f0))

### 📖 Documentation

- **docs:** Update documentation for recent bug fixes ([cbdabef](https://github.com/georgialexandrov/nestjs-ssr/commit/cbdabef))
- **docs:** Update installation to reflect automated setup ([44a1a98](https://github.com/georgialexandrov/nestjs-ssr/commit/44a1a98))

### ✅ Tests

- Fix unit tests for stream mode and exclude integration fixtures ([19df283](https://github.com/georgialexandrov/nestjs-ssr/commit/19df283))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.2.1

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.2.0...v0.2.1)

### 🩹 Fixes

- **cli:** Complete init script with critical template files and integration options ([676aea1](https://github.com/georgialexandrov/nestjs-ssr/commit/676aea1))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.2.0

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.1.12...v0.2.0)

### 🚀 Enhancements

- Add root layout auto-discovery and nested layout system ([2597652](https://github.com/georgialexandrov/nestjs-ssr/commit/2597652))
- **config:** Add custom HTML template support ([105a6eb](https://github.com/georgialexandrov/nestjs-ssr/commit/105a6eb))
- **hooks:** Add hook-based request context access ([29306a0](https://github.com/georgialexandrov/nestjs-ssr/commit/29306a0))
- **core:** ⚠️ Add security-first context with allowedHeaders/allowedCookies and createSSRHooks factory ([268dd42](https://github.com/georgialexandrov/nestjs-ssr/commit/268dd42))
- **render:** ⚠️ Change default SSR mode to stream for better performance ([2271648](https://github.com/georgialexandrov/nestjs-ssr/commit/2271648))
- **hooks:** Add useHeaders, useHeader, useCookies, and useCookie hooks ([0b2cc5b](https://github.com/georgialexandrov/nestjs-ssr/commit/0b2cc5b))

### 🩹 Fixes

- **examples:** Remove entry-client.tsx from tsconfig exclude for ESLint ([2ed62fa](https://github.com/georgialexandrov/nestjs-ssr/commit/2ed62fa))
- **config:** Properly configure TypeScript and ESLint for entry files ([0b90ff4](https://github.com/georgialexandrov/nestjs-ssr/commit/0b90ff4))
- **config:** Ignore entry files from ESLint ([935ff3e](https://github.com/georgialexandrov/nestjs-ssr/commit/935ff3e))
- **ci:** Fix commitlint validation in release workflow ([3ee64c1](https://github.com/georgialexandrov/nestjs-ssr/commit/3ee64c1))

### 💅 Refactors

- **hooks:** ⚠️ Remove obsolete useUserAgent, useAcceptLanguage, and useReferer hooks ([f37ccfc](https://github.com/georgialexandrov/nestjs-ssr/commit/f37ccfc))

### 📖 Documentation

- Add comprehensive layout system documentation ([f17fbb5](https://github.com/georgialexandrov/nestjs-ssr/commit/f17fbb5))
- **docs:** Fix head tags documentation to reflect actual API ([ba3beda](https://github.com/georgialexandrov/nestjs-ssr/commit/ba3beda))
- **docs:** Update API reference with new HeadData and RenderContext fields ([55e9142](https://github.com/georgialexandrov/nestjs-ssr/commit/55e9142))
- **docs:** Add comprehensive troubleshooting guide ([180f2f1](https://github.com/georgialexandrov/nestjs-ssr/commit/180f2f1))
- **docs:** Add comprehensive Clean Architecture guide ([d0f75bd](https://github.com/georgialexandrov/nestjs-ssr/commit/d0f75bd))
- **docs:** Add comprehensive performance tuning guide ([98037fa](https://github.com/georgialexandrov/nestjs-ssr/commit/98037fa))
- Improve homepage with clearer value proposition and DHH-style writing ([726898f](https://github.com/georgialexandrov/nestjs-ssr/commit/726898f))
- Improve README with DHH-style writing and clearer value proposition ([d401768](https://github.com/georgialexandrov/nestjs-ssr/commit/d401768))
- Rewrite introduction guide with deeper context and DHH-style writing ([cee04b8](https://github.com/georgialexandrov/nestjs-ssr/commit/cee04b8))
- Restructure documentation and update for new hook-based API ([46a6a04](https://github.com/georgialexandrov/nestjs-ssr/commit/46a6a04))

### 🏡 Chore

- ⚠️ V1 stabilization - API lockdown and security improvements ([069edda](https://github.com/georgialexandrov/nestjs-ssr/commit/069edda))
- **ci:** Add quality tools - lefthook, commitlint, size-limit ([e7115e8](https://github.com/georgialexandrov/nestjs-ssr/commit/e7115e8))
- **ci:** Add dependabot for automated dependency updates ([dd06f8c](https://github.com/georgialexandrov/nestjs-ssr/commit/dd06f8c))
- **ci:** Set up API Extractor for API stability tracking ([55f9add](https://github.com/georgialexandrov/nestjs-ssr/commit/55f9add))
- **ci:** Add code coverage reporting with thresholds ([b630b41](https://github.com/georgialexandrov/nestjs-ssr/commit/b630b41))
- Ignore auto-generated package README and Claude commands ([538b09c](https://github.com/georgialexandrov/nestjs-ssr/commit/538b09c))
- Remove auto-generated package README from git tracking ([04fb081](https://github.com/georgialexandrov/nestjs-ssr/commit/04fb081))

### ✅ Tests

- **render:** Add comprehensive render pipeline integration tests ([4857c20](https://github.com/georgialexandrov/nestjs-ssr/commit/4857c20))

#### ⚠️ Breaking Changes

- **core:** ⚠️ Add security-first context with allowedHeaders/allowedCookies and createSSRHooks factory ([268dd42](https://github.com/georgialexandrov/nestjs-ssr/commit/268dd42))
- **render:** ⚠️ Change default SSR mode to stream for better performance ([2271648](https://github.com/georgialexandrov/nestjs-ssr/commit/2271648))
- **hooks:** ⚠️ Remove obsolete useUserAgent, useAcceptLanguage, and useReferer hooks ([f37ccfc](https://github.com/georgialexandrov/nestjs-ssr/commit/f37ccfc))
- ⚠️ V1 stabilization - API lockdown and security improvements ([069edda](https://github.com/georgialexandrov/nestjs-ssr/commit/069edda))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

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
