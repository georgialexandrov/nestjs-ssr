# Installation

## Requirements

- Node.js 20+
- Existing NestJS app

## Setup

```bash
npx @nestjs-ssr/react init
```

Choose integration mode when prompted:

- **Integrated** — Vite middleware inside NestJS. One process.
- **Separate** — Vite on its own server. True HMR.

Or specify directly:

```bash
npx @nestjs-ssr/react init --integration integrated
npx @nestjs-ssr/react init --integration separate
```

This command:

- Installs `@nestjs-ssr/react`
- Creates `vite.config.ts` (configured for your mode)
- Adds client/server entry points
- Updates `tsconfig.json` for JSX
- Modifies `package.json` scripts

## Register Module

```typescript
// app.module.ts
import { RenderModule } from '@nestjs-ssr/react';

@Module({
  imports: [
    RenderModule.forRoot({
      allowedHeaders: ['accept-language'],
      allowedSessionProps: ['theme', 'locale'],
    }),
  ],
})
export class AppModule {}
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
npm run dev
```

Open `http://localhost:3000`. See "It works". Done.
