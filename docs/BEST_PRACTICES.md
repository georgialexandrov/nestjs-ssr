# SSR Framework Best Practices

## Research Summary

This document summarizes best practices from modern SSR frameworks (Nuxt 3, Next.js, Remix, SvelteKit, SolidStart) that inform our NestJS + React SSR architecture.

---

## Key Findings

### 1. Type Safety Approaches

**Best Practice: Type Inference with Runtime Validation**

```typescript
// ✅ BEST: Remix pattern
export async function loader({ params }: LoaderFunctionArgs) {
  const data = await fetchData();
  const validated = DataSchema.parse(data); // Zod validation
  return json({ validated });
}

// Type inference via typeof
const { validated } = useLoaderData<typeof loader>();
```

**Ranking:**
1. **Type inference + Zod** (Remix + validation)
2. **Auto-generated types** (SvelteKit `$types`)
3. **Type inference only** (Remix, SolidStart)
4. **Explicit generics** (Nuxt)
5. **No types** (JavaScript)

### 2. Request Context Patterns

**What Modern Frameworks Expose:**

| Framework | Params | Query | Headers | Cookies | User Context |
|-----------|--------|-------|---------|---------|--------------|
| Next.js | ✅ `params` | ✅ `searchParams` | ✅ `headers()` | ✅ `cookies()` | Custom |
| Remix | ✅ `params` | ✅ `url.searchParams` | ✅ `request.headers` | Parse from headers | `context` |
| SvelteKit | ✅ `params` | ✅ `url.searchParams` | ✅ `request.headers` | ✅ `cookies.get/set` | `locals` |
| Nuxt | ✅ `useRoute().params` | ✅ `useRoute().query` | ✅ `useRequestHeaders()` | ✅ `useCookie()` | Composables |

**Security Best Practices:**

✅ **Safe to expose:**
- Route parameters (already in URL)
- Query parameters (already in URL)
- User agent (device detection)
- Accept-Language (i18n)
- Referer (analytics)

❌ **Never expose:**
- Raw cookies
- Auth tokens
- Internal headers (X-Forwarded-For)
- Database credentials

### 3. Data Flow Patterns

**Pattern 1: Next.js Pages Router**
```typescript
export async function getServerSideProps(context) {
  const { params, query, req, res } = context;
  const data = await fetchData(params.id);
  return { props: { data } };
}

function Page({ data }) {
  return <div>{data.name}</div>;
}
```

**Pattern 2: Remix Loaders**
```typescript
export async function loader({ request, params }) {
  const data = await fetchData(params.id);
  return json({ data });
}

export default function Page() {
  const { data } = useLoaderData<typeof loader>();
  return <div>{data.name}</div>;
}
```

**Pattern 3: SvelteKit Load Functions**
```typescript
export const load: PageServerLoad = async ({ params, cookies }) => {
  const data = await fetchData(params.id);
  return { data };
};
```

**Key Insight:** All frameworks separate data fetching from rendering.

### 4. UnJS/Nuxt Patterns

**File-Based Routing:**
```
pages/
├── index.vue              → /
├── users/
│   ├── [id].vue          → /users/:id
│   └── [...slug].vue     → /users/* (catch-all)
```

**Data Fetching with useAsyncData:**
```typescript
const { data, pending, error } = await useAsyncData('key', async () => {
  return await $fetch('/api/users');
});
```

**Server Composables:**
```typescript
// Access request context
const headers = useRequestHeaders(['cookie']);
const route = useRoute();
const { id } = route.params;
const { search } = route.query;
```

**Takeaways for Our Implementation:**
- Composable pattern is elegant
- File-based routing reduces boilerplate
- SSR-friendly composables (work on server + client)

---

## Recommendations for NestJS + React SSR

### 1. Request Context Interface

```typescript
export interface RenderContext {
  // URL metadata
  url: string;
  path: string;
  query: Record<string, string | string[]>;
  params: Record<string, string>;

  // Safe headers
  userAgent?: string;
  acceptLanguage?: string;
  referer?: string;

  // Derived user context
  user?: {
    id: string;
    name: string;
  };
}
```

### 2. Type-Safe Props Pattern

```typescript
// Generic interface
export interface PageProps<TData = unknown> {
  data: TData;
  context: RenderContext;
}

// Usage
interface UserListData {
  users: User[];
}

export default function UserList({ data, context }: PageProps<UserListData>) {
  const { users } = data;
  const { query, params } = context;
  // ...
}
```

### 3. React Hooks for Context

```typescript
// Similar to Nuxt composables
export function usePageContext(): RenderContext
export function useParams(): Record<string, string>
export function useQuery(): Record<string, string | string[]>
export function useUserAgent(): string | undefined
```

### 4. Controller Type Annotations

```typescript
// Type-checked return value
interface HomeData {
  message: string;
}

@Get()
@ReactRender('app/views/home')
getHome(): HomeData {
  return { message: 'Hello' };
}
```

---

## Performance Best Practices

### 1. Streaming SSR (Next.js, SolidStart)

**Current:** `renderToString()` - waits for all content
**Better:** `renderToPipeableStream()` - progressive rendering

**Benefits:**
- Reduced TTFB (50-200ms vs 500-1000ms)
- Users see content faster
- Better perceived performance

### 2. Selective Hydration (React 18+)

```typescript
<Suspense fallback={<Skeleton />}>
  <HeavyComponent />
</Suspense>
```

- Prioritizes above-the-fold content
- Hydrates based on user interaction
- Prevents heavy components blocking page

### 3. Code Splitting

**All frameworks recommend:**
- Route-level splitting (lazy load per page)
- Component-level splitting (dynamic imports)
- Vendor chunking (React separate from app code)

### 4. Caching Strategies

**stale-while-revalidate pattern:**
```typescript
res.setHeader('Cache-Control',
  'public, max-age=60, stale-while-revalidate=3600'
);
```

- Serve cached content immediately
- Revalidate in background
- Best for mostly-static content

---

## Common Patterns Across Frameworks

### 1. Automatic Serialization

All frameworks automatically serialize server data to client:

- **Next.js:** Via `props`
- **Remix:** Via `loader` return
- **SvelteKit:** Via `load` return
- **Nuxt:** Via `useAsyncData`

**Our approach:** `window.__INITIAL_STATE__` with `serialize-javascript`

### 2. Environment Detection

```typescript
if (typeof window === 'undefined') {
  // Server-only code
}

if (import.meta.env.SSR) {
  // Server-only (Vite)
}

if (process.env.NODE_ENV === 'production') {
  // Production-only
}
```

### 3. Error Boundaries

All React-based frameworks use Error Boundaries:

```typescript
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

### 4. Metadata/Head Management

- **Next.js:** `<Head>` component or metadata export
- **Remix:** `<Meta>` component
- **SvelteKit:** `<svelte:head>`
- **Nuxt:** `useHead()` composable

**For us:** Consider adding `useHead()` hook in future

---

## Anti-Patterns to Avoid

### ❌ Don't: Use `any` types

```typescript
// Bad
function render(data: any) { ... }

// Good
function render<T>(data: T) { ... }
```

### ❌ Don't: Expose sensitive data to client

```typescript
// Bad
return {
  user,
  sessionToken,  // ❌
  apiKey,        // ❌
}

// Good
return {
  user: {
    id: user.id,
    name: user.name,
    // Only safe fields
  }
}
```

### ❌ Don't: Couple server and client code

```typescript
// Bad - won't work on client
const data = await database.query(...);

// Good - separate server and client concerns
// Server: loader/getServerSideProps
// Client: fetch API
```

### ❌ Don't: Forget hydration consistency

```typescript
// Bad - different on server vs client
<div>{Date.now()}</div>

// Good - same data source
<div>{props.timestamp}</div>
```

---

## Inspiration for Future Features

### tRPC Integration (Type-Safe APIs)

```typescript
// End-to-end type safety
const user = await trpc.user.get.query({ id: '1' });
// 'user' type inferred from backend
```

### File-Based Routing

```
src/view/pages/
├── index.tsx              → /
├── users/
│   └── [id].tsx          → /users/:id
```

Auto-register routes from file structure (like Next.js/Nuxt)

### Middleware Pattern

```typescript
// Run before rendering
export const middleware = async (context) => {
  if (!context.user) {
    return redirect('/login');
  }
};
```

---

## Summary: What We're Adopting

From the research, we're implementing:

1. **Type inference** (Remix-style) with generics
2. **Request context** (Next.js/SvelteKit-style) via context object
3. **React hooks** (Nuxt composables-style) for accessing context
4. **Runtime validation** (Zod) for safety
5. **Error boundaries** (universal pattern)
6. **Streaming SSR** (future) for performance
7. **Security-first** context exposure

What makes us unique:
- **NestJS architecture** (controllers, services, DI)
- **Domain-driven design** (views in modules)
- **Decorator-based** routing (vs file-based)
- **Flexibility** (full control over server)
