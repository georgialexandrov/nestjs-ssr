# Changelog

## v0.3.14

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.13...v0.3.14)

### 🚀 Enhancements

- **render:** Add JSON API mode for content negotiation ([738c626](https://github.com/georgialexandrov/nestjs-ssr/commit/738c626))

### 📖 Documentation

- **docs:** Add json-api-mode change plan ([baa38df](https://github.com/georgialexandrov/nestjs-ssr/commit/baa38df))
- **docs:** Archive json-api-mode change, sync specs ([4939318](https://github.com/georgialexandrov/nestjs-ssr/commit/4939318))

### 🏡 Chore

- **config:** Ignore AI tooling config directories ([7cbcd3a](https://github.com/georgialexandrov/nestjs-ssr/commit/7cbcd3a))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.13

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.12...v0.3.13)

### 🏡 Chore

- Add .internal/ to gitignore, fix lint error in auth guard ([7578200](https://github.com/georgialexandrov/nestjs-ssr/commit/7578200))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.12

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.11...v0.3.12)

## v0.3.11

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.10...v0.3.11)

### 🏡 Chore

- **deps)(deps:** Bump the nestjs group with 3 updates ([#36](https://github.com/georgialexandrov/nestjs-ssr/pull/36))

## v0.3.10

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.9...v0.3.10)

### 🏡 Chore

- **deps)(deps:** Bump devalue from 5.6.2 to 5.6.3 ([#34](https://github.com/georgialexandrov/nestjs-ssr/pull/34))

## v0.3.9

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.8...v0.3.9)

### 🏡 Chore

- **deps)(deps:** Bump citty from 0.2.0 to 0.2.1 ([#32](https://github.com/georgialexandrov/nestjs-ssr/pull/32))
- **deps-dev)(deps-dev:** Bump globals from 16.5.0 to 17.3.0 ([#31](https://github.com/georgialexandrov/nestjs-ssr/pull/31))
- **deps-dev)(deps-dev:** Bump the dev-dependencies group across 1 directory with 7 updates ([#33](https://github.com/georgialexandrov/nestjs-ssr/pull/33))

## v0.3.8

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.7...v0.3.8)

### 🚀 Enhancements

- **examples:** Replace users app with recipe site, remove minimal-fastify ([7dbece0](https://github.com/georgialexandrov/nestjs-ssr/commit/7dbece0))

### 🩹 Fixes

- **hydration:** Resolve layout hydration on hard refresh ([3e5a3bf](https://github.com/georgialexandrov/nestjs-ssr/commit/3e5a3bf))

### 📖 Documentation

- Overhaul homepage, README, and llms.txt ([e87bfa8](https://github.com/georgialexandrov/nestjs-ssr/commit/e87bfa8))

### ✅ Tests

- **render:** Add E2E acceptance tests for Express and Fastify adapters ([96fa8d4](https://github.com/georgialexandrov/nestjs-ssr/commit/96fa8d4))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.7

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.6...v0.3.7)

### 🚀 Enhancements

- **examples:** Add minimal Fastify example with streaming SSR ([73bfcb0](https://github.com/georgialexandrov/nestjs-ssr/commit/73bfcb0))

### 🩹 Fixes

- **render:** Handle missing request.path for Fastify adapter ([16c02cb](https://github.com/georgialexandrov/nestjs-ssr/commit/16c02cb))

### 🏡 Chore

- **ci:** Bump actions/checkout to v6 and upload-pages-artifact to v4 ([7d33fc1](https://github.com/georgialexandrov/nestjs-ssr/commit/7d33fc1))

### ✅ Tests

- **render:** Add Fastify adapter compatibility tests for interceptor ([78ccf50](https://github.com/georgialexandrov/nestjs-ssr/commit/78ccf50))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.6

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.5...v0.3.6)

### 🚀 Enhancements

- **render:** Add Fastify adapter support for streaming SSR ([741a7f3](https://github.com/georgialexandrov/nestjs-ssr/commit/741a7f3))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.5

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.4...v0.3.5)

### 🚀 Enhancements

- **render:** Add context factory for custom context properties ([513ff6a](https://github.com/georgialexandrov/nestjs-ssr/commit/513ff6a))

### 🩹 Fixes

- **layout:** Fix nested layout composition and hydration ([d283a48](https://github.com/georgialexandrov/nestjs-ssr/commit/d283a48))

### 📖 Documentation

- Reorganize documentation structure ([94de5a7](https://github.com/georgialexandrov/nestjs-ssr/commit/94de5a7))
- Add context factory to llms.txt ([87bf31f](https://github.com/georgialexandrov/nestjs-ssr/commit/87bf31f))
- Fix broken links and update homepage ([0ae1df7](https://github.com/georgialexandrov/nestjs-ssr/commit/0ae1df7))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.4

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.3...v0.3.4)

### 🩹 Fixes

- **hydration:** Align client-side layout composition with server rendering ([71d1bc4](https://github.com/georgialexandrov/nestjs-ssr/commit/71d1bc4))
- **cli:** Resolve TypeScript and ESLint warnings ([0912418](https://github.com/georgialexandrov/nestjs-ssr/commit/0912418))
- **config:** Use project TypeScript for api-extractor ([f1a2007](https://github.com/georgialexandrov/nestjs-ssr/commit/f1a2007))
- **config:** Regenerate API report with bundled TypeScript format ([48b2c16](https://github.com/georgialexandrov/nestjs-ssr/commit/48b2c16))

### 📖 Documentation

- Add Tailwind CSS integration guide ([c209bf3](https://github.com/georgialexandrov/nestjs-ssr/commit/c209bf3))

### 🏡 Chore

- **ci:** Add coverage check to pre-commit and adjust thresholds ([cbf04b6](https://github.com/georgialexandrov/nestjs-ssr/commit/cbf04b6))
- **ci:** Add full CI checks to pre-commit hook ([5fb84cb](https://github.com/georgialexandrov/nestjs-ssr/commit/5fb84cb))
- **ci:** Remove API surface check from CI and pre-commit ([4e785cd](https://github.com/georgialexandrov/nestjs-ssr/commit/4e785cd))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.3

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.2...v0.3.3)

### 🩹 Fixes

- **render:** Load root layout from entry-server bundle in production ([23f1672](https://github.com/georgialexandrov/nestjs-ssr/commit/23f1672))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.2

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.1...v0.3.2)

## v0.3.1

[compare changes](https://github.com/georgialexandrov/nestjs-ssr/compare/v0.3.0...v0.3.1)

### 🩹 Fixes

- **render:** Fix duplicate layout and segment rendering ([e7bda38](https://github.com/georgialexandrov/nestjs-ssr/commit/e7bda38))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.3.0

### 🚀 Enhancements

- **streaming:** Add inline error overlay for streaming SSR errors ([f50c20a](https://github.com/georgialexandrov/nestjs-ssr/commit/f50c20a))
- **render:** Add segment rendering and client-side navigation ([38f7ff4](https://github.com/georgialexandrov/nestjs-ssr/commit/38f7ff4))
- **examples:** Add client-side navigation demo with active link highlighting ([195f932](https://github.com/georgialexandrov/nestjs-ssr/commit/195f932))

### 🩹 Fixes

- **hydration:** Wrap SSR output with PageContextProvider for hooks support ([b9bd070](https://github.com/georgialexandrov/nestjs-ssr/commit/b9bd070))

### 💅 Refactors

- **vite:** ⚠️ Remove embedded mode, keep only HMR proxy mode ([82a6581](https://github.com/georgialexandrov/nestjs-ssr/commit/82a6581))
- **render:** Extract StringRenderer and StreamRenderer classes ([8a1039d](https://github.com/georgialexandrov/nestjs-ssr/commit/8a1039d))

#### ⚠️ Breaking Changes

- **vite:** ⚠️ Remove embedded mode, keep only HMR proxy mode ([82a6581](https://github.com/georgialexandrov/nestjs-ssr/commit/82a6581))

### ❤️ Contributors

- Georgi Alexandrov <georgi@alexandrov.dev>

## v0.2.5 (Initial Public Release)

React SSR for NestJS with full TypeScript type safety.

### Core Features

- **Server-Side Rendering** - String and streaming modes with React 19
- **Client Hydration** - Seamless hydration with props serialization
- **Vite Integration** - Embedded or proxy mode with HMR support
- **Layout System** - Root layout auto-discovery and nested layouts
- **Request Context** - Hooks for params, query, headers, cookies
- **Security** - allowedHeaders/allowedCookies whitelist, XSS protection
- **CLI Tool** - `npx @nestjs-ssr/react init` scaffolds your project

### Architecture

Controllers return data, React components render views:

```typescript
@Controller()
export class AppController {
  @Get()
  @Render(HomePage)
  index() {
    return { title: 'Welcome' };
  }
}
```

NestJS owns routing, guards, interceptors. React is just the view layer.

### Requirements

- NestJS 11+
- React 19+
- Vite 6+

### Contributors

- Georgi Alexandrov ([@georgialexandrov](https://github.com/georgialexandrov))
