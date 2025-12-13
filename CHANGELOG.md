# Changelog

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
