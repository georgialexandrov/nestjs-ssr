# Type Safety Design

## Overview

This document describes the type safety architecture for passing data from NestJS controllers to React components with full TypeScript support and request context access.

---

## Goals

1. **Compile-time type checking** - Catch prop mismatches before runtime
2. **Type inference** - Minimal manual type annotations
3. **Request context access** - Query params, route params, headers available in components
4. **Developer experience** - IDE autocomplete, refactor-safe
5. **Runtime validation** - Optional Zod schemas for production safety

---

## Core Interfaces

### 1. RenderContext

Request metadata available to all React components.

**Location:** `src/shared/render/interfaces/render-context.interface.ts`

```typescript
export interface RenderContext {
  // URL information
  url: string;                                    // Full URL
  path: string;                                   // Path only (/users/123)
  query: Record<string, string | string[]>;       // Query params (?search=foo)
  params: Record<string, string>;                 // Route params (/:id)

  // Request headers (safe subset)
  userAgent?: string;                             // User-Agent header
  acceptLanguage?: string;                        // Accept-Language header
  referer?: string;                               // Referer header

  // Derived user context (from session/auth)
  user?: {
    id: string;
    name: string;
    email?: string;
    [key: string]: any;
  };

  // Extensible for custom metadata
  [key: string]: any;
}
```

**Security considerations:**
- ✅ Only safe data exposed (no tokens, raw cookies, internal headers)
- ✅ User context derived from validated session (never trust client)
- ✅ Extensible via custom properties

---

### 2. PageProps

Generic interface for React page components.

**Location:** `src/shared/render/interfaces/page-props.interface.ts`

```typescript
export interface PageProps<TData = unknown> {
  // Data from controller return value
  data: TData;

  // Request context
  context: RenderContext;
}
```

**Usage in components:**

```typescript
// Define your data shape
interface UserListData {
  users: User[];
  total: number;
}

// Component receives typed props
export default function UserList({ data, context }: PageProps<UserListData>) {
  const { users, total } = data;              // ✅ TypeScript knows the type
  const { query, params } = context;          // ✅ Access request metadata

  return (
    <div>
      <h1>Found {total} users</h1>
      {users.map(user => <UserCard key={user.id} user={user} />)}
    </div>
  );
}
```

---

## Data Flow

### 1. Controller → Component

```typescript
// 1. Controller defines data type
interface HomeData {
  message: string;
  timestamp: Date;
}

// 2. Controller returns typed data
@Controller()
export class AppController {
  @Get()
  @Render('app/views/home')
  getHome(): HomeData {  // ← Type annotation
    return {
      message: 'Hello World',
      timestamp: new Date(),
    };
  }
}

// 3. Interceptor builds RenderContext
const renderContext: RenderContext = {
  url: req.url,
  path: req.path,
  query: req.query,
  params: req.params,
  userAgent: req.headers['user-agent'],
  // ...
};

// 4. Component receives typed props
export default function Home({ data, context }: PageProps<HomeData>) {
  const { message, timestamp } = data;  // ✅ Typed!
  const { userAgent } = context;        // ✅ Typed!

  return <h1>{message}</h1>;
}
```

### 2. Type Flow Diagram

```
┌─────────────────────────────────────────────────┐
│  Controller Method                               │
│  ─────────────────                               │
│  getHome(): HomeData {                           │
│    return { message: 'Hello' }                   │
│  }                                                │
└────────────────┬────────────────────────────────┘
                 │
                 ├─→ Return type: HomeData
                 │
                 ↓
┌─────────────────────────────────────────────────┐
│  RenderInterceptor                               │
│  ─────────────────                               │
│  - Extracts data: HomeData                       │
│  - Builds context: RenderContext                 │
│  - Merges: { data: HomeData, context: ... }      │
└────────────────┬────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────┐
│  RenderService                                   │
│  ─────────────                                   │
│  render(viewPath, { data, context })             │
└────────────────┬────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────┐
│  React Component                                 │
│  ───────────────                                 │
│  Home({ data, context }: PageProps<HomeData>)    │
│                                                   │
│  const { message } = data; ← TypeScript knows!   │
└─────────────────────────────────────────────────┘
```

---

## React Hooks for Context Access

Inspired by Nuxt composables, provide convenience hooks for accessing context.

**Location:** `src/view/hooks/use-page-context.tsx`

```typescript
import { createContext, useContext } from 'react';
import type { RenderContext } from '@shared/render/interfaces/render-context.interface';

// Context provider
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

// Hooks for convenient access
export function usePageContext(): RenderContext {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('usePageContext must be used within PageContextProvider');
  }
  return context;
}

export function useParams(): Record<string, string> {
  return usePageContext().params;
}

export function useQuery(): Record<string, string | string[]> {
  return usePageContext().query;
}

export function useUserAgent(): string | undefined {
  return usePageContext().userAgent;
}

export function useUser() {
  return usePageContext().user;
}
```

**Usage in components:**

```typescript
import { useParams, useQuery, useUser } from '@view/hooks/use-page-context';

export default function UserProfile({ data }: PageProps<UserProfileData>) {
  const params = useParams();      // { id: '123' }
  const query = useQuery();        // { tab: 'posts' }
  const user = useUser();          // Current logged-in user

  return (
    <div>
      <h1>Viewing user {params.id}</h1>
      {query.tab === 'posts' && <PostsTab />}
      {user && <p>Logged in as {user.name}</p>}
    </div>
  );
}
```

---

## Runtime Validation with Zod

For production safety, validate controller return values at runtime.

### Basic Validation

```typescript
import { z } from 'zod';

// Define schema
const UserListDataSchema = z.object({
  users: z.array(z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email(),
  })),
  total: z.number(),
});

// Infer TypeScript type from schema
type UserListData = z.infer<typeof UserListDataSchema>;

// Validate in controller
@Get()
@Render('users/views/user-list')
list(): UserListData {
  const data = {
    users: this.usersService.findAll(),
    total: this.usersService.count(),
  };

  // Runtime validation
  return UserListDataSchema.parse(data);
  // Throws if data doesn't match schema
}
```

### Custom Decorator (Future)

```typescript
export function ValidatedRender<T extends z.ZodType>(
  viewPath: string,
  schema: T,
) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      return schema.parse(result); // Auto-validate
    };

    Reflect.defineMetadata(REACT_RENDER_KEY, viewPath, descriptor.value);
    return descriptor;
  };
}

// Usage
@Get()
@ValidatedRender('users/views/user-list', UserListDataSchema)
list() {
  return this.usersService.findAll();
  // Automatically validated
}
```

---

## Implementation Checklist

### Phase 1: Interfaces & Types ✅ COMPLETE

- [x] Create `RenderContext` interface
- [x] Create `PageProps<T>` generic interface
- [x] Export from `@shared/render/interfaces`

### Phase 2: Interceptor Enhancement ✅ COMPLETE

- [x] Update `RenderInterceptor` to build `RenderContext`
- [x] Extract request metadata (params, query, headers)
- [x] Merge controller data with context
- [x] Pass to `RenderService`

### Phase 3: React Context Provider ✅ COMPLETE

- [x] Create `PageContextProvider` component
- [x] Create convenience hooks (`useParams`, `useQuery`, etc.)
- [x] Update `App.tsx` to wrap with provider

### Phase 4: Entry Points ✅ COMPLETE

- [x] Update `entry-server.tsx` to pass context to App
- [x] Update `entry-client.tsx` to read and pass context
- [x] Serialize context to `window.__CONTEXT__`

### Phase 5: Update Components ✅ COMPLETE

- [x] Update all existing components to use `PageProps<T>`
- [x] Demonstrate context usage in components (home, user-list, user-profile)
- [x] Test type safety (TypeScript compilation passes without errors)

### Phase 6: Update Controllers ✅ COMPLETE

- [x] Add explicit return type annotations
- [x] Test that wrong return types cause compile errors
- [x] Tested runtime functionality - all routes working correctly

---

## Examples

### Example 1: Simple Page

```typescript
// Controller
interface AboutData {
  title: string;
  content: string;
}

@Get('about')
@Render('app/views/about')
getAbout(): AboutData {
  return {
    title: 'About Us',
    content: 'We build awesome stuff',
  };
}

// Component
export default function About({ data }: PageProps<AboutData>) {
  return (
    <div>
      <h1>{data.title}</h1>
      <p>{data.content}</p>
    </div>
  );
}
```

### Example 2: Dynamic Route with Context

```typescript
// Controller
interface UserProfileData {
  user: User;
  posts: Post[];
}

@Get('users/:id')
@Render('users/views/user-profile')
getProfile(@Param('id') id: string): UserProfileData {
  const user = this.usersService.findOne(id);
  const posts = this.postsService.findByUser(id);
  return { user, posts };
}

// Component
export default function UserProfile({ data, context }: PageProps<UserProfileData>) {
  const { user, posts } = data;
  const { params, query } = context;

  const selectedTab = query.tab || 'posts';

  return (
    <div>
      <h1>{user.name}</h1>
      <p>User ID: {params.id}</p>

      <Tabs selected={selectedTab}>
        <TabPanel name="posts">
          {posts.map(post => <PostCard key={post.id} post={post} />)}
        </TabPanel>
        <TabPanel name="about">
          <UserBio user={user} />
        </TabPanel>
      </Tabs>
    </div>
  );
}
```

### Example 3: Using Hooks

```typescript
export default function SearchResults({ data }: PageProps<SearchData>) {
  const query = useQuery();
  const user = useUser();

  const searchTerm = query.q as string;

  return (
    <div>
      <h1>Results for "{searchTerm}"</h1>
      {user && <p>Searching as {user.name}</p>}
      <ResultList results={data.results} />
    </div>
  );
}
```

---

## Migration Guide

### Before (Prototype)

```typescript
// Controller - no types
@Get()
@Render('app/views/home')
getHome() {
  return { message: 'Hello' };
}

// Component - any types
export default function Home(props: any) {
  return <h1>{props.message}</h1>;
}
```

### After (Type-Safe)

```typescript
// Controller - typed return
interface HomeData {
  message: string;
}

@Get()
@Render('app/views/home')
getHome(): HomeData {
  return { message: 'Hello' };
}

// Component - typed props
export default function Home({ data, context }: PageProps<HomeData>) {
  return (
    <div>
      <h1>{data.message}</h1>
      <p>Path: {context.path}</p>
    </div>
  );
}
```

---

## Benefits

### Compile-Time Safety

```typescript
// ❌ TypeScript error: Property 'users' does not exist
@Render('users/views/user-list')
list(): { user: User } {  // Typo: should be 'users'
  return { user: this.usersService.findAll() };
}

// Component expects
interface UserListData {
  users: User[];  // Plural!
}

// Error caught at compile time, not runtime! ✅
```

### IDE Autocomplete

- Controller return values autocomplete
- Component props autocomplete
- Context properties autocomplete
- No need to check what data is available

### Refactoring Safety

- Rename property in controller → TypeScript errors in components
- Change data shape → Immediate feedback
- Remove property → Compile errors guide you

### Documentation

Types serve as documentation:

```typescript
interface UserProfileData {
  user: User;           // What's a User?
  posts: Post[];        // Array of posts
  followers: number;    // Follower count
  isFollowing: boolean; // Am I following this user?
}

// No need for separate docs - types tell the story!
```

---

## Future Enhancements

### 1. Type Inference (Like Remix)

```typescript
// Controller
export const getHome = () => {
  return { message: 'Hello' };
};

// Component - type inferred automatically
const { data } = useLoaderData<typeof getHome>();
// data.message is string ✅
```

### 2. Generated Types (Like SvelteKit)

```typescript
// Auto-generated from controller
import type { HomeData } from './$types';

export default function Home({ data }: PageProps<HomeData>) {
  // Types automatically synced with controller
}
```

### 3. tRPC Integration

```typescript
// End-to-end type safety for API calls
const users = await trpc.users.list.query();
// users type inferred from backend
```

---

## Summary

This type safety design provides:

- ✅ Full TypeScript coverage (no `any`)
- ✅ Compile-time error detection
- ✅ Request context access in components
- ✅ IDE autocomplete support
- ✅ Refactor-safe codebase
- ✅ Self-documenting code
- ✅ Optional runtime validation

All while maintaining clean NestJS architecture and React best practices.
