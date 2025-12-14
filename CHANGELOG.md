# Changelog

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
