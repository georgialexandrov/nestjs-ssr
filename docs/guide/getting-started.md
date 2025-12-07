# Getting Started

This guide shows you how to add React SSR to a NestJS application.

## Prerequisites

You need Node.js 18+ and a NestJS application. If you don't have one:

```bash
npx @nestjs/cli new my-app && cd my-app
```

## Installation

Install the required packages:

```bash
npm install @nestjs-ssr/react react react-dom vite @vitejs/plugin-react
```

**Optional** (for HMR with separate Vite server):

```bash
npm install http-proxy-middleware
npm install -D concurrently
```

## Setup

### 1. Configure Vite

Create `vite.config.ts` in your project root:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viewRegistryPlugin } from '@nestjs-ssr/react/vite';

export default defineConfig({
  plugins: [
    react(),
    viewRegistryPlugin(),
  ],
  server: {
    port: 5173,
  },
});
```

The `viewRegistryPlugin` automatically discovers React components in `views/` folders and makes them available for server rendering.

### 2. Register the Module

Update `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';

@Module({
  imports: [
    RenderModule, // Zero config - embedded mode by default
  ],
  controllers: [AppController],
})
export class AppModule {}
```

**That's it!** No configuration needed for the simplest setup.

### 3. Create Main File

Your `src/main.ts` stays simple - everything is automatic:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.listen(3000);
  console.log('Application running on http://localhost:3000');
}

bootstrap();
```

The `RenderModule` automatically configures:
- **Development**: Vite middleware for SSR (embedded mode - single process, no HMR)
- **Production**: Static asset serving from `dist/client` with caching headers

**Want HMR?** See the [Development Setup](/guide/development-setup) guide to enable proxy mode.

### 4. Create Your First View

Create `src/views/home.tsx`:

```typescript
import type { PageProps } from '@nestjs-ssr/react';

interface HomeData {
  message: string;
}

export default function Home({ data }: PageProps<HomeData>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <title>NestJS SSR</title>
      </head>
      <body>
        <div id="root">
          <h1>{data.message}</h1>
        </div>
      </body>
    </html>
  );
}
```

### 5. Add a Route

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

The `@Render` decorator tells NestJS to render the controller's return value with the specified React component.

### 6. Update Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "nest start --watch",
    "build": "vite build --outDir dist/client && vite build --ssr src/view/entry-server.tsx --outDir dist/server && nest build",
    "start:prod": "node dist/main"
  }
}
```

**For HMR** (optional), install `concurrently` and run both Vite and NestJS:

```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"nest start --watch\""
  }
}
```

### 7. Run

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). You should see your server-rendered page.

The Vite plugin automatically generates:
- `src/view/entry-client.tsx` - Client-side hydration code
- `src/view/entry-server.tsx` - Server-side rendering code
- `src/view/view-registry.generated.ts` - Registry of all view components

You never need to touch these files - they're managed automatically.

## Add Interactivity

Update `src/views/home.tsx` to include client-side state:

```typescript
import { useState } from 'react';
import type { PageProps } from '@nestjs-ssr/react';

interface HomeData {
  message: string;
}

export default function Home({ data }: PageProps<HomeData>) {
  const [count, setCount] = useState(0);

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <title>NestJS SSR</title>
      </head>
      <body>
        <div id="root">
          <h1>{data.message}</h1>
          <p>Count: {count}</p>
          <button onClick={() => setCount(count + 1)}>
            Increment
          </button>
        </div>
      </body>
    </html>
  );
}
```

The initial HTML renders on the server. When JavaScript loads, React hydrates the DOM and the button becomes interactive.

## How It Works

1. Request hits NestJS server
2. Controller method executes and returns data
3. `@Render` decorator intercepts the response
4. React component renders to HTML on the server
5. HTML sends to browser with embedded state
6. React hydrates the DOM
7. Page becomes interactive

## Next Steps

- [Core Concepts](/guide/core-concepts) - Understand SSR, hydration, and the view registry
- [Forms and Data](/guide/forms-and-data) - Handle user input and data fetching
- [Production Deployment](/guide/production) - Deploy your application

## Troubleshooting

**View not found**
Ensure the file exists at the path specified in `@Render()`. Paths are relative to `src/`. Restart the dev server after creating new views.

**Hydration mismatch**
Server and client must render identical HTML. Avoid using `Date.now()`, `Math.random()`, or browser APIs during rendering. Use `useEffect` for client-only code.

**Port 3000 already in use**
Stop other processes or change the port in `src/main.ts`.

**Module not found**
Run `npm install` to ensure all dependencies are installed.
