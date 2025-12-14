# Installation

## Requirements

- Node.js 20+
- Existing NestJS app

## Setup

```bash
npx @nestjs-ssr/react init
```

This command:

- Installs `@nestjs-ssr/react` and dependencies
- Registers `RenderModule` in `app.module.ts`
- Adds `enableShutdownHooks()` to `main.ts`
- Creates `vite.config.ts`
- Adds client/server entry points
- Updates `tsconfig.json` for JSX
- Modifies `package.json` scripts

## Custom Vite Port

```bash
npx @nestjs-ssr/react init --port 3001
```

## Verify

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
export default function Home({ data }: PageProps<{ message: string }>) {
  return <h1>{data.message}</h1>;
}
```

```bash
pnpm start:dev
```

Open `http://localhost:3000`. See "It works". Done.
