# Installation

This guide shows you how to add React SSR to a NestJS application.

## Prerequisites

- Node.js 18+
- An existing NestJS application

If you don't have a NestJS app:

```bash
npx @nestjs/cli new my-app
cd my-app
```

## Install Dependencies

```bash
npm install @nestjs-ssr/react react react-dom vite @vitejs/plugin-react
```

## Configure Vite

Create `vite.config.ts` in your project root:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viewRegistryPlugin } from '@nestjs-ssr/react/vite';

export default defineConfig({
  plugins: [react(), viewRegistryPlugin()],
});
```

The `viewRegistryPlugin` automatically discovers React components in `views/` folders.

## Configure TypeScript

Update your `tsconfig.json` to support React JSX:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

This enables the modern JSX transform for React 17+.

## Configure Build Scripts

Update your `package.json` to add build scripts for client and server bundles:

```json
{
  "scripts": {
    "build": "npm run build:client && npm run build:server && nest build",
    "build:client": "vite build --ssrManifest --outDir dist/client",
    "build:server": "vite build --ssr node_modules/@nestjs-ssr/react/src/templates/entry-server.tsx --outDir dist/server"
  }
}
```

These scripts:
- `build:client` - Builds the client bundle with Vite manifest for production
- `build:server` - Builds the server bundle for SSR
- `build` - Runs both builds and then builds the NestJS application

## Register the Module

Update `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';

@Module({
  imports: [RenderModule],
  controllers: [AppController],
})
export class AppModule {}
```

That's it. The `RenderModule` automatically configures development and production modes.

## Create Your First View

Create `src/views/home.tsx`:

```typescript
import type { PageProps } from '@nestjs-ssr/react';

interface HomeData {
  message: string;
}

export default function Home({ data }: PageProps<HomeData>) {
  return (
    <div>
      <h1>{data.message}</h1>
      <p>Welcome to NestJS SSR</p>
    </div>
  );
}
```

## Add a Route

Update `src/app.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';

@Controller()
export class AppController {
  @Get()
  @Render('views/home')
  getHome() {
    return {
      message: 'Hello from NestJS SSR',
    };
  }
}
```

## Run Your Application

```bash
npm run start:dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your server-rendered page.

## Add Client-Side Interactivity

Update `src/views/home.tsx` to include state:

```typescript
import { useState } from 'react';
import type { PageProps } from '@nestjs-ssr/react';

interface HomeData {
  message: string;
}

export default function Home({ data }: PageProps<HomeData>) {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>{data.message}</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
```

The initial HTML renders on the server. When JavaScript loads, React hydrates and the button becomes interactive.

## Next Steps

- [Core Concepts](/guide/core-concepts) - Understand SSR and hydration
- [Development Setup](/guide/development-setup) - Configure HMR modes
- [Head Tags](/guide/head-tags) - Add meta tags and SEO
