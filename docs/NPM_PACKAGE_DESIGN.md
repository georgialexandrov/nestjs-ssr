# NPM Package Design: Type-Safe Context Extension

This document explains how to design the library for npm distribution so developers can extend `RenderContext` cleanly without modifying package code.

---

## The Problem

When publishing as an npm package, developers need to extend `RenderContext` without:
- Forking the package
- Using type assertions everywhere
- Overriding package internals
- Losing type safety

---

## Solution: Declaration Merging

Use TypeScript's **declaration merging** pattern (same as Express.js, Passport, etc.).

### How It Works

The package defines a base interface, and users **augment** it in their own code. TypeScript automatically merges the declarations.

---

## Package Structure

### Step 1: Package Exports Clean Interfaces

**Package:** `@your-org/nestjs-react-ssr`

**File:** `src/interfaces/render-context.interface.ts`

```typescript
/**
 * Request context available to all React components.
 *
 * Extend this interface in your app code using declaration merging:
 *
 * @example
 * ```typescript
 * // In your app's types/render.d.ts
 * declare module '@your-org/nestjs-react-ssr' {
 *   interface RenderContext {
 *     user?: { id: string; name: string };
 *     tenant?: { id: string; name: string };
 *   }
 * }
 * ```
 */
export interface RenderContext {
  // Base properties (always available)
  url: string;
  path: string;
  query: Record<string, string | string[]>;
  params: Record<string, string>;
  userAgent?: string;
  acceptLanguage?: string;
  referer?: string;
}
```

**File:** `src/interfaces/page-props.interface.ts`

```typescript
import type { RenderContext } from './render-context.interface';

/**
 * Generic interface for React page component props.
 *
 * @template TData - The shape of data returned by the controller
 */
export interface PageProps<TData = unknown> {
  data: TData;
  context: RenderContext;  // Uses the merged interface!
}
```

**File:** `src/hooks/use-page-context.tsx`

```typescript
import { createContext, useContext } from 'react';
import type { RenderContext } from '../interfaces';

const PageContext = createContext<RenderContext | null>(null);

export function PageContextProvider({
  context,
  children,
}: {
  context: RenderContext;
  children: React.ReactNode;
}) {
  return <PageContext.Provider value={context}>{children}</PageContext.Provider>;
}

/**
 * Hook to access page context.
 * Returns the full context with any custom properties you've added.
 */
export function usePageContext(): RenderContext {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('usePageContext must be used within PageContextProvider');
  }
  return context;  // Automatically typed with merged interface!
}

export function useParams(): Record<string, string> {
  return usePageContext().params;
}

export function useQuery(): Record<string, string | string[]> {
  return usePageContext().query;
}

// ... other hooks
```

---

## User's App Code

### Step 2: User Extends via Declaration Merging

**User's File:** `src/types/nestjs-react-ssr.d.ts`

```typescript
// Augment the package's types with app-specific properties
declare module '@your-org/nestjs-react-ssr' {
  // Merge additional properties into RenderContext
  interface RenderContext {
    // Authentication
    user?: {
      id: string;
      name: string;
      email: string;
      roles: string[];
    };

    // Multi-tenancy
    tenant?: {
      id: string;
      name: string;
      plan: 'free' | 'pro' | 'enterprise';
    };

    // Localization
    locale?: string;

    // Feature flags
    features?: Record<string, boolean>;
  }
}

// This is crucial - makes this file a module
export {};
```

### Step 3: User Creates Custom Hooks (Optional)

**User's File:** `src/hooks/use-app-context.ts`

```typescript
import { usePageContext } from '@your-org/nestjs-react-ssr';

/**
 * Hook to access current user.
 * Thanks to declaration merging, TypeScript knows about the 'user' property!
 */
export function useUser() {
  return usePageContext().user;  // ✅ Typed correctly, no assertion needed!
}

export function useTenant() {
  return usePageContext().tenant;  // ✅ Typed correctly!
}

export function useLocale() {
  return usePageContext().locale || 'en';  // ✅ Typed correctly!
}

export function useFeature(name: string): boolean {
  return usePageContext().features?.[name] || false;  // ✅ Typed correctly!
}
```

### Step 4: User Builds Context in Interceptor

**User's File:** `src/interceptors/render.interceptor.ts`

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { RenderInterceptor as BaseRenderInterceptor } from '@your-org/nestjs-react-ssr';
import type { RenderContext } from '@your-org/nestjs-react-ssr';

@Injectable()
export class AppRenderInterceptor extends BaseRenderInterceptor {
  protected buildContext(request: any): RenderContext {
    // Get base context from parent
    const baseContext = super.buildContext(request);

    // Add app-specific properties
    // TypeScript knows about these thanks to declaration merging!
    return {
      ...baseContext,
      user: request.user,           // ✅ Typed!
      tenant: request.tenant,       // ✅ Typed!
      locale: request.locale,       // ✅ Typed!
      features: request.features,   // ✅ Typed!
    };
  }
}
```

### Step 5: Use in Components

**User's File:** `src/users/views/dashboard.tsx`

```typescript
import type { PageProps } from '@your-org/nestjs-react-ssr';
import { useUser, useTenant } from '../../hooks/use-app-context';

interface DashboardData {
  stats: { views: number; likes: number };
}

export default function Dashboard({ data, context }: PageProps<DashboardData>) {
  const user = useUser();      // ✅ Typed as { id: string; name: string; ... } | undefined
  const tenant = useTenant();  // ✅ Typed as { id: string; name: string; ... } | undefined

  // Can also access directly from context
  const locale = context.locale;  // ✅ Typed correctly!

  if (!user) {
    return <p>Please log in</p>;
  }

  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
      {tenant && <p>Organization: {tenant.name}</p>}
      <p>Stats: {data.stats.views} views</p>
    </div>
  );
}
```

---

## Key Benefits

### ✅ No Type Assertions Needed

```typescript
// ❌ Without declaration merging
const user = (usePageContext() as AppRenderContext).user;

// ✅ With declaration merging
const user = usePageContext().user;  // Just works!
```

### ✅ Autocomplete Everywhere

- IDE suggests `user`, `tenant`, etc. on `context` object
- No need to remember what properties are available
- Refactoring is safe - rename propagates everywhere

### ✅ One-Time Configuration

Define your types once in `types/nestjs-react-ssr.d.ts`, use everywhere.

### ✅ Library Stays Generic

The npm package has no opinions about auth, tenants, etc. Users add what they need.

---

## Package's Type Exports

**File:** `package.json` (in npm package)

```json
{
  "name": "@your-org/nestjs-react-ssr",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

**File:** `src/index.ts` (main export)

```typescript
// Types
export type { RenderContext } from './interfaces/render-context.interface';
export type { PageProps } from './interfaces/page-props.interface';

// Hooks
export {
  PageContextProvider,
  usePageContext,
  useParams,
  useQuery,
  useUserAgent,
  useAcceptLanguage,
  useReferer,
} from './hooks/use-page-context';

// Decorators
export { ReactRender } from './decorators/react-render.decorator';

// Services
export { RenderService } from './services/render.service';
export { RenderInterceptor } from './interceptors/render.interceptor';

// Modules
export { RenderModule } from './render.module';
```

---

## Documentation for Users

### Quick Start Guide (in package README)

```markdown
## Extending Context

To add custom properties to the request context:

1. Create a type declaration file:

**src/types/nestjs-react-ssr.d.ts**
\`\`\`typescript
declare module '@your-org/nestjs-react-ssr' {
  interface RenderContext {
    user?: {
      id: string;
      name: string;
      email: string;
    };
  }
}

export {};
\`\`\`

2. Make sure this file is included in your tsconfig.json:

\`\`\`json
{
  "include": ["src/**/*"]
}
\`\`\`

3. Use in your components:

\`\`\`typescript
import { usePageContext } from '@your-org/nestjs-react-ssr';

export default function MyComponent({ data, context }: PageProps<MyData>) {
  const user = context.user;  // ✅ Fully typed!
  // ...
}
\`\`\`

That's it! TypeScript automatically merges your types.
```

---

## Alternative: Generic Types Approach

If you prefer explicit generics over declaration merging:

```typescript
// Package defines generic versions
export interface PageProps<TData = unknown, TContext extends RenderContext = RenderContext> {
  data: TData;
  context: TContext;
}

export function usePageContext<T extends RenderContext = RenderContext>(): T {
  // ...
}

// User defines their context type
interface AppContext extends RenderContext {
  user?: User;
}

// User uses it
const context = usePageContext<AppContext>();
const user = context.user;  // ✅ Typed
```

**Pros:**
- Explicit type parameters
- No global augmentation

**Cons:**
- Must specify generic everywhere: `usePageContext<AppContext>()`
- More verbose
- Easy to forget generic parameter

**Recommendation:** Use declaration merging (like Express). It's cleaner and more ergonomic.

---

## Real-World Example: Express.js

This is exactly how Express extends types:

```typescript
// In @types/express
declare global {
  namespace Express {
    interface Request {
      user?: any;  // Passport adds this
    }
  }
}

// In user's code with Passport
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
      };
    }
  }
}

// Now everywhere in the app
app.get('/profile', (req, res) => {
  const user = req.user;  // ✅ Typed as { id: string; name: string } | undefined
});
```

---

## Summary

For npm package distribution:

1. ✅ Ship with base `RenderContext` interface
2. ✅ Document declaration merging pattern
3. ✅ Users extend once in `types/nestjs-react-ssr.d.ts`
4. ✅ Full type safety everywhere with zero type assertions
5. ✅ Library stays generic, users add what they need

This is the industry-standard pattern used by Express, Passport, and other major libraries.
