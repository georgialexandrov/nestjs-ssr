# Extending RenderContext

This guide shows how to extend the base `RenderContext` interface to add app-specific properties like user authentication, tenant information, or custom metadata.

---

## Why Extend?

The base `RenderContext` provides generic request metadata (URL, params, query, headers). Many applications need additional context:

- **Authentication**: User information from sessions/JWT
- **Multi-tenancy**: Tenant/organization data
- **Localization**: Locale settings beyond Accept-Language
- **Feature flags**: User-specific feature toggles
- **Analytics**: Tracking IDs, session data
- **Custom metadata**: App-specific request context

---

## Step 1: Define Your Extended Context

Create an interface that extends `RenderContext`:

**File:** `src/shared/render/interfaces/app-render-context.interface.ts`

```typescript
import type { RenderContext } from './render-context.interface';

/**
 * Application-specific render context.
 * Extends the base RenderContext with authentication and tenant data.
 */
export interface AppRenderContext extends RenderContext {
  // Current authenticated user (from session/JWT)
  user?: {
    id: string;
    name: string;
    email: string;
    roles: string[];
    avatar?: string;
  };

  // Multi-tenancy support
  tenant?: {
    id: string;
    name: string;
    plan: 'free' | 'pro' | 'enterprise';
  };

  // Locale (parsed from Accept-Language or user preference)
  locale?: string;

  // Feature flags for the current user/tenant
  features?: {
    betaFeatures: boolean;
    darkMode: boolean;
    [key: string]: boolean;
  };
}
```

**Export it:**

```typescript
// src/shared/render/interfaces/index.ts
export type { RenderContext } from './render-context.interface.js';
export type { PageProps } from './page-props.interface.js';
export type { AppRenderContext } from './app-render-context.interface.js';
```

---

## Step 2: Update Your Interceptor

Build the extended context in your render interceptor:

**File:** `src/shared/render/render.interceptor.ts`

```typescript
import type { AppRenderContext } from './interfaces/index.js';

@Injectable()
export class RenderInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // ... existing code ...

    return next.handle().pipe(
      switchMap(async (data) => {
        const httpContext = context.switchToHttp();
        const request = httpContext.getRequest<Request>();

        // Build extended context
        const renderContext: AppRenderContext = {
          // Base properties
          url: request.url,
          path: request.path,
          query: request.query as Record<string, string | string[]>,
          params: request.params as Record<string, string>,
          userAgent: request.headers['user-agent'],
          acceptLanguage: request.headers['accept-language'],
          referer: request.headers.referer,

          // Extended properties
          user: request.user, // From Passport/JWT guard
          tenant: request.tenant, // From custom tenant middleware
          locale: request.locale || 'en',
          features: {
            betaFeatures: request.user?.roles?.includes('beta-tester'),
            darkMode: request.user?.preferences?.darkMode,
          },
        };

        // ... rest of interceptor logic ...
      }),
    );
  }
}
```

---

## Step 3: Create Custom Hooks

Create convenience hooks for accessing your extended context:

**File:** `src/view/hooks/use-app-context.tsx`

```typescript
import { usePageContext } from './use-page-context';
import type { AppRenderContext } from '../../shared/render/interfaces';

/**
 * Hook to access the app-specific context.
 * Returns the full context with type safety for extended properties.
 */
export function useAppContext(): AppRenderContext {
  return usePageContext() as AppRenderContext;
}

/**
 * Hook to access the current authenticated user.
 * Returns undefined if no user is logged in.
 */
export function useUser() {
  return useAppContext().user;
}

/**
 * Hook to access the current tenant information.
 * Returns undefined if not in a multi-tenant context.
 */
export function useTenant() {
  return useAppContext().tenant;
}

/**
 * Hook to access the current locale.
 */
export function useLocale(): string {
  return useAppContext().locale || 'en';
}

/**
 * Hook to check if a feature flag is enabled.
 */
export function useFeature(featureName: string): boolean {
  const features = useAppContext().features || {};
  return features[featureName] || false;
}
```

---

## Step 4: Use in Components

Now use your custom hooks in React components:

**Example:** User-aware component

```typescript
import type { PageProps } from '@shared/render/interfaces';
import { useUser, useFeature } from '@view/hooks/use-app-context';

interface DashboardData {
  stats: {
    views: number;
    likes: number;
  };
}

export default function Dashboard({ data, context }: PageProps<DashboardData>) {
  const user = useUser();
  const hasBetaAccess = useFeature('betaFeatures');

  if (!user) {
    return <p>Please log in to view your dashboard.</p>;
  }

  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
      <p>Email: {user.email}</p>

      {hasBetaAccess && (
        <div className="beta-banner">
          You have access to beta features!
        </div>
      )}

      <div>
        <h2>Your Stats</h2>
        <p>Views: {data.stats.views}</p>
        <p>Likes: {data.stats.likes}</p>
      </div>
    </div>
  );
}
```

**Example:** Tenant-aware component

```typescript
import { useTenant } from '@view/hooks/use-app-context';

export default function Header() {
  const tenant = useTenant();

  return (
    <header>
      <h1>{tenant?.name || 'My App'}</h1>
      {tenant && (
        <span className="plan-badge">{tenant.plan}</span>
      )}
    </header>
  );
}
```

**Example:** Locale-aware component

```typescript
import { useLocale } from '@view/hooks/use-app-context';

const translations = {
  en: { greeting: 'Hello', logout: 'Logout' },
  es: { greeting: 'Hola', logout: 'Cerrar sesión' },
  fr: { greeting: 'Bonjour', logout: 'Se déconnecter' },
};

export default function Navigation() {
  const locale = useLocale();
  const t = translations[locale] || translations.en;

  return (
    <nav>
      <span>{t.greeting}</span>
      <button>{t.logout}</button>
    </nav>
  );
}
```

---

## Step 5: Type-Safe PageProps

Your components still use `PageProps<T>` but have access to extended context:

```typescript
import type { PageProps } from '@shared/render/interfaces';
import type { AppRenderContext } from '@shared/render/interfaces/app-render-context.interface';

interface ProfileData {
  posts: Post[];
  followers: number;
}

export default function Profile({ data, context }: PageProps<ProfileData>) {
  // Base context properties
  const { params } = context;

  // Extended context properties (with type assertion)
  const appContext = context as AppRenderContext;
  const currentUser = appContext.user;
  const tenant = appContext.tenant;

  // Or use hooks
  const user = useUser();

  return (
    <div>
      <h1>Profile: {params.username}</h1>
      {currentUser && <p>Viewing as: {currentUser.name}</p>}
      {tenant && <p>Organization: {tenant.name}</p>}
    </div>
  );
}
```

---

## Common Patterns

### Pattern 1: Conditional Rendering Based on User Role

```typescript
import { useUser } from '@view/hooks/use-app-context';

export default function AdminPanel({ data }: PageProps<any>) {
  const user = useUser();

  if (!user) {
    return <p>Please log in</p>;
  }

  if (!user.roles.includes('admin')) {
    return <p>Access denied. Admin role required.</p>;
  }

  return <div>Admin Panel Content...</div>;
}
```

### Pattern 2: Multi-Tenant Styling

```typescript
import { useTenant } from '@view/hooks/use-app-context';

export default function ThemedButton({ label }: { label: string }) {
  const tenant = useTenant();

  const style = {
    backgroundColor: tenant?.plan === 'enterprise' ? '#gold' : '#blue',
    color: 'white',
  };

  return <button style={style}>{label}</button>;
}
```

### Pattern 3: Feature Flags

```typescript
import { useFeature } from '@view/hooks/use-app-context';

export default function Dashboard({ data }: PageProps<DashboardData>) {
  const hasNewUI = useFeature('newDashboardUI');

  if (hasNewUI) {
    return <NewDashboard data={data} />;
  }

  return <LegacyDashboard data={data} />;
}
```

---

## Best Practices

### 1. Security: Only Expose Safe Data

❌ **Don't** expose sensitive data:

```typescript
// BAD - exposes sensitive data to client
const renderContext: AppRenderContext = {
  user: {
    ...request.user,
    passwordHash: request.user.passwordHash, // ❌ Never!
    apiKeys: request.user.apiKeys,            // ❌ Never!
  },
};
```

✅ **Do** only expose safe, necessary data:

```typescript
// GOOD - only public user data
const renderContext: AppRenderContext = {
  user: request.user ? {
    id: request.user.id,
    name: request.user.name,
    email: request.user.email,
    avatar: request.user.avatar,
    roles: request.user.roles,
  } : undefined,
};
```

### 2. Keep Context Serializable

All context properties are serialized to `window.__CONTEXT__` for client hydration. Ensure everything is JSON-serializable:

❌ **Don't** include functions, classes, or circular references:

```typescript
// BAD - can't be serialized
user: {
  getName: () => 'John',      // ❌ Function
  createdAt: new Date(),      // ❌ Date object
  service: userService,       // ❌ Class instance
}
```

✅ **Do** use plain objects and primitives:

```typescript
// GOOD - serializable
user: {
  name: 'John',
  createdAt: '2024-01-01T00:00:00Z', // ISO string
  isActive: true,
}
```

### 3. Type Safety

Always use TypeScript interfaces for your extended context:

```typescript
// Define types for all custom properties
interface UserContext {
  id: string;
  name: string;
  roles: ('admin' | 'user' | 'moderator')[];  // Union type for safety
}

interface AppRenderContext extends RenderContext {
  user?: UserContext;  // Optional - not all requests have users
}
```

---

## Summary

To extend RenderContext for your app:

1. ✅ Create `AppRenderContext` interface extending `RenderContext`
2. ✅ Update your interceptor to build the extended context
3. ✅ Create custom hooks for accessing extended properties
4. ✅ Use hooks in components for clean, type-safe access
5. ✅ Only expose safe, serializable data
6. ✅ Keep the base library generic - extensions in your app code

This pattern keeps the library flexible while allowing full customization for your specific needs!
