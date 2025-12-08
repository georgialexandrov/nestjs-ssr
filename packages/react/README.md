# @nestjs-ssr/react

> **⚠️ Preview Release**
> This package is currently in active development. The API may change between minor versions. Production use is not recommended yet.

Server-side rendering for React in NestJS with full TypeScript support and type-safe props.

## Features

- **Type-Safe Props** - TypeScript validates controller returns match component props
- **Zero Config** - Works out of the box with sensible defaults
- **Streaming SSR** - Modern renderToPipeableStream support
- **HMR in Development** - Powered by Vite for instant feedback
- **Production Ready** - Code splitting, caching, and optimizations built-in

## Installation

```bash
npm install @nestjs-ssr/react
npx nestjs-ssr  # Set up your project automatically
```

The CLI installs dependencies, creates entry files, and configures TypeScript/Vite for you.

## Usage

**1. Register the module**

```typescript
// app.module.ts
import { RenderModule } from '@nestjs-ssr/react';

@Module({
  imports: [RenderModule],
})
export class AppModule {}
```

**2. Create a view component**

```typescript
// src/views/home.tsx
import type { PageProps } from '@nestjs-ssr/react';

export interface HomeProps {
  message: string;
}

export default function Home(props: PageProps<HomeProps>) {
  return <h1>{props.message}</h1>;
}
```

**3. Use in a controller**

```typescript
// app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';
import Home from './views/home';

@Controller()
export class AppController {
  @Get()
  @Render(Home)
  getHome() {
    return { message: 'Hello World' };  // TypeScript validates this!
  }
}
```

That's it! Run `npm run dev` and visit http://localhost:3000

## API

### React Hooks

```typescript
import { usePageContext, useParams, useQuery } from '@nestjs-ssr/react';

function MyComponent() {
  const context = usePageContext();  // { url, path, query, params, ... }
  const params = useParams();        // Route params
  const query = useQuery();          // Query string
  return <div>User ID: {params.id}</div>;
}
```

### Head Tags & SEO

```typescript
import { Head } from '@nestjs-ssr/react';

export default function MyPage(props: PageProps<MyProps>) {
  return (
    <>
      <Head>
        <title>My Page</title>
        <meta name="description" content="Page description" />
      </Head>
      <div>{props.content}</div>
    </>
  );
}
```

## Documentation

- [Full Documentation](https://georgialexandrov.github.io/nestjs-ssr/)
- [Examples](https://github.com/georgialexandrov/nestjs-ssr/tree/main/examples)
- [GitHub](https://github.com/georgialexandrov/nestjs-ssr)

## Requirements

- Node.js 20+
- NestJS 11+
- React 19+
- TypeScript 5+

## License

MIT © [Georgi Alexandrov](https://github.com/georgialexandrov)
