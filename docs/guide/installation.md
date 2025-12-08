# Installation

This guide shows you how to add React SSR to a NestJS application.

## Prerequisites

- Node.js 20+
- An existing NestJS application with `tsconfig.json`

If you don't have a NestJS app:

```bash
npx @nestjs/cli new my-app
cd my-app
```

## Quick Start with CLI

The CLI automatically installs dependencies and sets up your project:

```bash
# Install the package
npm install @nestjs-ssr/react

# Run the initialization command
npx nestjs-ssr
```

This command will:
- **Install missing dependencies** - Automatically installs `react`, `react-dom`, `vite`, and `@vitejs/plugin-react` if not found
- Create `src/views/entry-client.tsx` - Client-side hydration entry point
- Create `src/views/entry-server.tsx` - Server-side rendering entry point
- Create `src/global.d.ts` - TypeScript definitions for window globals
- Create or update `vite.config.js` - Vite configuration with path aliases
- Update `tsconfig.json` - Add React JSX support and path configuration
- Update `package.json` build scripts - Add Vite build commands

### CLI Options

```bash
npx nestjs-ssr --views src/custom-views  # Custom views directory
npx nestjs-ssr --force                    # Overwrite existing files
npx nestjs-ssr --skip-install             # Skip automatic dependency installation
```

### Manual Dependency Installation (Optional)

If you prefer to install dependencies manually or want to use the `--skip-install` flag:

```bash
npm install @nestjs-ssr/react react react-dom vite @vitejs/plugin-react
```

## Manual Configuration (Alternative)

If you prefer manual setup or need to customize:

### 1. Configure TypeScript

Ensure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["vite/client"]
  }
}
```

### 2. Configure Vite

Create `vite.config.js` in your project root:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
  build: {
    outDir: 'dist/client',
    manifest: true,
    rollupOptions: {
      input: {
        client: resolve(__dirname, 'src/views/entry-client.tsx'),
      },
    },
  },
});
```

The `@` alias allows importing views with `@/views` which is used by the hydration system.

### 3. Configure Build Scripts

Update your `package.json` to add build scripts:

```json
{
  "scripts": {
    "build": "vite build && nest build",
    "build:client": "vite build --ssrManifest --outDir dist/client",
    "build:server": "vite build --ssr src/views/entry-server.tsx --outDir dist/server"
  }
}
```

These scripts:
- `build` - Builds client bundle then NestJS application
- `build:client` - Builds the client bundle with manifest for production
- `build:server` - Builds the server-side rendering bundle

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

export interface HomeProps {
  message: string;
}

export default function Home(props: PageProps<HomeProps>) {
  return (
    <div>
      <h1>{props.message}</h1>
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
import Home from './views/home';

@Controller()
export class AppController {
  @Get()
  @Render(Home)  // Type-safe! Cmd+Click to navigate
  getHome() {
    return {
      message: 'Hello from NestJS SSR',
    };
  }
}
```

**What's happening here:**
- Import the component directly for IDE navigation
- `@Render(Home)` passes the component reference
- TypeScript validates your return value matches `HomeProps`
- Build errors if you return wrong props!

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

export interface HomeProps {
  message: string;
}

export default function Home(props: PageProps<HomeProps>) {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>{props.message}</h1>
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
