# Request Context

Hooks expose request data to components. Works during SSR and after hydration.

## Hooks

```tsx
import {
  useParams,
  useQuery,
  useHeaders,
  useHeader,
  useCookies,
  useCookie,
  useRequest,
  usePageContext,
} from '@nestjs-ssr/react/client';
```

Use `/client` for browser-safe imports. The main export includes server-only code.

**useParams** — Route parameters:

```tsx
const { id } = useParams();
// Route: /users/:id → { id: '123' }
```

**useQuery** — Query string:

```tsx
const { page, sort } = useQuery();
// URL: /users?page=1&sort=name → { page: '1', sort: 'name' }
```

**useHeaders** — Allowed headers:

```tsx
const headers = useHeaders();
// { 'x-tenant-id': 'tenant-123', 'accept-language': 'en-US' }
```

**useHeader** — Single header:

```tsx
const tenantId = useHeader('x-tenant-id');
```

**useCookies** — Allowed cookies:

```tsx
const cookies = useCookies();
// { theme: 'dark', locale: 'en-US' }
```

**useCookie** — Single cookie:

```tsx
const theme = useCookie('theme');
```

**useRequest** — Full request context:

```tsx
const { url, method, path, params, query } = useRequest();
```

**usePageContext** — Everything including custom properties:

```tsx
const ctx = usePageContext();
// { url, path, params, query, method, user, tenant, ... }
```

## Filtering Headers & Cookies

Headers and cookies are not exposed by default. Allowlist explicitly:

```typescript
RenderModule.forRoot({
  allowedHeaders: ['accept-language', 'x-tenant-id'],
  allowedCookies: ['theme', 'locale'],
});
```

Everything else stays server-side.

Allowed values live in their own bags, lowercased:

```typescript
const ctx = usePageContext();
ctx.headers['x-tenant-id'];
ctx.cookies.theme;
```

They are bags rather than top-level properties so a header named `path` cannot
shadow the URL, and so an application context key cannot be silently overwritten
by an incoming header. `useHeader()` and `useHeaders()` read the bag for you.

Credential-bearing headers — `authorization`, `proxy-authorization`, `cookie`,
`x-api-key`, and similar — are refused even if they appear in `allowedHeaders`.
The refusal is logged; the value never is.

::: warning Deprecated
Allowed headers are still mirrored as top-level context properties
(`ctx['x-tenant-id']`) for compatibility, with a development warning. Read them
from `ctx.headers` — the aliases are removed in the next major.
:::

## Custom Context Properties

For data like authenticated user, tenant, or feature flags, use the `context` factory:

```typescript
RenderModule.forRoot({
  context: ({ req }) => ({
    user: req.user, // From Passport/JWT
    tenant: req.tenant, // From middleware
  }),
});
```

Access in components:

```tsx
const { user, tenant } = usePageContext();
```

Whatever the factory returns is serialized into the page, so it is usually a
domain object where a DTO belongs. `projectContext` is the one place to narrow
it, and it applies to HTML hydration, JSON, and navigation segments alike:

```typescript
RenderModule.forRoot({
  context: ({ req }) => ({ user: req.user }),
  projectContext: ({ context }) => ({
    ...context,
    user: context.user && { id: context.user.id, name: context.user.name },
  }),
});
```

The projected context is validated and size-checked before any response header
is written; a value that cannot be safely serialized fails the request rather
than reaching the browser.

See [Authentication Guide](/guide/authentication) for complete setup.

## Typed Hooks

Create typed hooks for your app's context:

```typescript
// src/lib/ssr-hooks.ts
import { createSSRHooks, RenderContext } from '@nestjs-ssr/react/client';

interface AppContext extends RenderContext {
  user?: { id: string; name: string; role: string };
  tenant?: { id: string; name: string };
}

export const { usePageContext, useParams, useQuery, useRequest } =
  createSSRHooks<AppContext>();

// Convenience hooks
export const useUser = () => usePageContext().user;
export const useTenant = () => usePageContext().tenant;
```

Use throughout your app with full type safety:

```tsx
import { useUser } from '@/lib/ssr-hooks';

export default function Dashboard() {
  const user = useUser(); // Fully typed!
  return <h1>Welcome, {user?.name}</h1>;
}
```
