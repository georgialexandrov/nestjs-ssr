# Authentication

Pass authenticated user data from your auth layer (Passport, JWT, etc.) to React components via the context factory.

## Overview

The pattern is:

1. Auth guard/strategy sets `req.user`
2. Context factory reads `req.user` and adds to render context
3. React components access via `usePageContext()` or typed hooks

## Basic Setup

### 1. Create Auth Guard

A simple guard that validates authentication and sets user on request:

```typescript
// src/auth/auth.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Your auth logic here - validate JWT, session, etc.
    // For demo, we set a mock user
    request.user = {
      id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'admin',
    };

    return true;
  }
}
```

### 2. Configure Context Factory

Add the context factory to `RenderModule` to pass user to React:

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RenderModule } from '@nestjs-ssr/react';
import { AuthGuard } from './auth/auth.guard';

@Module({
  imports: [
    RenderModule.forRoot({
      context: ({ req }) => ({
        user: req.user,
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
```

### 3. Create Typed Hooks

Define your app's context type for full type safety:

```typescript
// src/lib/ssr-hooks.ts
import { createSSRHooks, RenderContext } from '@nestjs-ssr/react/client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface AppContext extends RenderContext {
  user?: User;
}

export const { usePageContext, useParams, useQuery, useRequest } =
  createSSRHooks<AppContext>();

export const useUser = () => usePageContext().user;
```

### 4. Use in Components

```tsx
// src/views/layout.tsx
import { useUser } from '../lib/ssr-hooks';

export default function Layout({ children }) {
  const user = useUser();

  return (
    <div>
      <header>
        {user ? (
          <span>
            Welcome, {user.name} ({user.role})
          </span>
        ) : (
          <a href="/login">Sign In</a>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}
```

## With Passport JWT

For real JWT authentication with `@nestjs/passport`:

```typescript
// src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { sub: string }) {
    // This sets req.user automatically
    return this.userService.findById(payload.sub);
  }
}
```

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { RenderModule } from '@nestjs-ssr/react';
import { JwtStrategy } from './auth/jwt.strategy';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
    RenderModule.forRoot({
      context: ({ req }) => ({
        user: req.user,
      }),
    }),
  ],
  providers: [
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
```

## With nestjs-cls

For more complex scenarios, use [nestjs-cls](https://github.com/Papooch/nestjs-cls) (Continuation Local Storage):

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ClsModule, ClsService } from 'nestjs-cls';
import { RenderModule } from '@nestjs-ssr/react';

@Module({
  imports: [
    ClsModule.forRoot({
      middleware: { mount: true },
    }),
    RenderModule.forRootAsync({
      imports: [ClsModule],
      inject: [ClsService],
      useFactory: (cls: ClsService) => ({
        context: ({ req }) => ({
          user: req.user,
          tenant: cls.get('tenant'),
          featureFlags: cls.get('featureFlags'),
        }),
      }),
    }),
  ],
})
export class AppModule {}
```

Set values anywhere in the request lifecycle:

```typescript
// In middleware, guard, or service
cls.set('tenant', await tenantService.getByHost(req.hostname));
cls.set('featureFlags', await featureFlagService.getFlags(req.user));
```

## Async Context Factory

For context that requires async operations:

```typescript
RenderModule.forRootAsync({
  imports: [PermissionModule],
  inject: [PermissionService],
  useFactory: (permissionService: PermissionService) => ({
    context: async ({ req }) => ({
      user: req.user,
      permissions: req.user
        ? await permissionService.getForUser(req.user.id)
        : [],
    }),
  }),
});
```

## Security Notes

::: warning
The context is serialized to the client as `window.__CONTEXT__`. Only include data safe to expose publicly.
:::

**Do:**

- User ID, name, role
- Feature flags
- Tenant info
- Preferences

**Don't:**

- Passwords or tokens
- Internal IDs
- Sensitive business data
- PII not needed by UI

## Type Safety

The `ContextFactory` type is exported for custom factory functions:

```typescript
import { ContextFactory, RenderContext } from '@nestjs-ssr/react';

interface AppContext extends RenderContext {
  user?: User;
  permissions: string[];
}

const contextFactory: ContextFactory = async ({ req }) => ({
  user: req.user,
  permissions: await getPermissions(req.user),
});
```
