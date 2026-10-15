# Installation

## Requirements

- An existing NestJS 11 or 12 app (`nest new` works as is — ES module and
  CommonJS projects are both supported)
- Node.js 22.17+

## Setup

```bash
npx @nestjs-ssr/react init
```

This command:

- Installs `@nestjs-ssr/react` and dependencies with your package manager
  (pnpm, npm, yarn or bun, detected from your lockfile)
- Registers `RenderModule` in `app.module.ts`
- Adds `enableShutdownHooks()` to `main.ts`
- Creates `vite.config.ts`
- Adds client/server entry points
- Adds a starter root layout (light/dark theme) and a `/welcome` page
- Updates `tsconfig.json` for JSX
- Modifies `package.json` scripts

It never overwrites a file that exists (unless `--force`), and your own
controllers and tests are left alone.

### pnpm 11 and later

pnpm 11+ fails an install when a dependency's build script has not been
approved. A fresh `nest new` app can trip this before init runs: Nest 11's
template (through `@parcel/watcher`) and the swc builder (`@swc/core`) both
ship build scripts. Run `pnpm approve-builds` once in the app, then init. None
of init's own dependencies need one.

If an install fails anyway, init leaves the project files in place, prints the
install commands to rerun, and exits with a non-zero code.

init installs the exact version of `@nestjs-ssr/react` you ran it from, so a
release candidate installs itself rather than the latest stable release.

## Options

| Flag             | Effect                                                |
| ---------------- | ----------------------------------------------------- |
| `--port 3001`    | Vite dev server port (default 5173)                   |
| `--mode stream`  | Use streaming SSR (`renderToPipeableStream`)          |
| `--pm npm`       | Package manager for installs and scripts              |
| `--no-examples`  | Skip the starter layout and `/welcome` page           |
| `--skip-install` | Do not install dependencies                           |
| `--project web`  | Nest CLI project name, for monorepos                  |
| `--yes`          | Never prompt (implied when not running in a terminal) |

## Verify

```bash
pnpm start:dev
```

Open `http://localhost:3000/welcome`. The starter page explains how the request
became a page, and its counter proves the page hydrated.

## Your first page

```typescript
// app.controller.ts
@Get()
@Render(Home)
getHome() {
  return { message: 'It works' };
}
```

```tsx
// views/home.tsx
export default function Home({ message }: PageProps<{ message: string }>) {
  return <h1>{message}</h1>;
}
```

Open `http://localhost:3000`. See "It works". Done.

In a Nest 12 (ES module) project, write the import as `'./views/home.js'`.
