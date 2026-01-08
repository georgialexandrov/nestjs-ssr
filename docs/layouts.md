# Layouts

Wrap pages with shared UI. Headers, footers, sidebars.

## Root Layout

Auto-discovered from `src/views/layout.tsx`:

```tsx
import type { LayoutProps } from '@nestjs-ssr/react';

export default function RootLayout({ children }: LayoutProps) {
  return (
    <>
      <style>{`body { margin: 0; font-family: system-ui; }`}</style>
      <div id="app">{children}</div>
    </>
  );
}

RootLayout.displayName = 'RootLayout';
```

Discovery paths (first match wins):

- `src/views/layout.tsx`
- `src/views/layout/index.tsx`
- `src/views/_layout.tsx`

No file? No root layout. Pages render directly.

## Controller Layout

Apply to all routes in a controller:

```typescript
@Controller('dashboard')
@Layout(DashboardLayout, { props: { showSidebar: true } })
export class DashboardController {
  @Get()
  @Render(Overview)
  getOverview() {
    return { stats: {} };
  }
}
```

## Method Layout

Override for specific routes:

```typescript
@Get('settings')
@Render(Settings, { layout: SettingsLayout })
getSettings() {
  return { settings: {} };
}
```

## Hierarchy

Layouts nest: Root > Controller > Method > Page

```
RootLayout
└── DashboardLayout
    └── SettingsLayout
        └── SettingsPage
```

## Layout Props

Props can come from three places:

```typescript
// 1. Controller decorator - goes to controller layout only
@Layout(DashboardLayout, { props: { sidebar: true } })

// 2. Method decorator - goes to method layout only
@Render(Page, { layoutProps: { activeTab: 'settings' } })

// 3. Return value - goes to ALL layouts (highest priority)
return {
  data: { ... },
  layoutProps: { title: 'Dynamic Title' }
};
```

Each layout receives its own decorator props merged with the return value props:

```tsx
// Controller layout receives: { sidebar: true, title: 'Dynamic Title' }
// Method layout receives: { activeTab: 'settings', title: 'Dynamic Title' }
// Root layout receives: { title: 'Dynamic Title' }
```

Usage:

```tsx
export default function DashboardLayout({
  children,
  layoutProps,
}: LayoutProps) {
  return (
    <div>
      <h1>{layoutProps?.title}</h1>
      {layoutProps?.sidebar && <Sidebar />}
      {children}
    </div>
  );
}
```

## Skip Layouts

```typescript
// Skip controller layout only
@Render(Modal, { layout: false })

// Skip ALL layouts (including root)
@Render(Bare, { layout: null })
```

## displayName Required

Production builds minify function names. Set `displayName` on every layout:

```tsx
export default function AdminLayout({ children }: LayoutProps) {
  return <div className="admin">{children}</div>;
}

AdminLayout.displayName = 'AdminLayout';
```

Without it, layout detection breaks. Names become `default` or `e`.

## Type Safety

```tsx
interface MainLayoutProps {
  title: string;
  subtitle?: string;
}

export default function MainLayout({
  children,
  layoutProps,
}: LayoutProps<MainLayoutProps>) {
  const { title, subtitle } = layoutProps || {};
  return (
    <header>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}
```

## Nested Layouts

Build complex UIs with multiple layout levels. Common pattern: root layout with main nav, section layout with submenu.

### Example: Users Section

Root layout with top navigation:

```tsx
// src/views/layout.tsx
import type { LayoutProps } from '@nestjs-ssr/react';
import { Link } from '@nestjs-ssr/react/client';
import { useRequest } from '../lib/ssr-hooks';

export default function RootLayout({ children }: LayoutProps) {
  const { path } = useRequest();

  return (
    <div>
      <nav>
        <Link href="/" style={path === '/' ? activeStyle : linkStyle}>
          Home
        </Link>
        <Link
          href="/users"
          style={path.startsWith('/users') ? activeStyle : linkStyle}
        >
          Users
        </Link>
      </nav>
      <main>{children}</main>
    </div>
  );
}

RootLayout.displayName = 'RootLayout';
```

Users section layout with submenu:

```tsx
// src/views/users-layout.tsx
import type { LayoutProps } from '@nestjs-ssr/react';
import { Link } from '@nestjs-ssr/react/client';
import { useRequest } from '../lib/ssr-hooks';

export default function UsersLayout({ children }: LayoutProps) {
  const { path } = useRequest();

  return (
    <div>
      <nav className="submenu">
        <Link href="/users" style={path === '/users' ? activeStyle : linkStyle}>
          All Users
        </Link>
        <Link
          href="/users/settings"
          style={path === '/users/settings' ? activeStyle : linkStyle}
        >
          Settings
        </Link>
      </nav>
      <div>{children}</div>
    </div>
  );
}

UsersLayout.displayName = 'UsersLayout';
```

Apply to controller:

```typescript
// src/users.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Render, Layout } from '@nestjs-ssr/react';
import UsersLayout from './views/users-layout';
import UsersList from './views/users-list';
import UsersSettings from './views/users-settings';

@Controller('users')
@Layout(UsersLayout)
export class UsersController {
  @Get()
  @Render(UsersList)
  listUsers() {
    return { users: [{ id: 1, name: 'Alice' }] };
  }

  @Get('settings')
  @Render(UsersSettings)
  getSettings() {
    return { settings: { darkMode: false } };
  }
}
```

### Result

```
RootLayout (top nav: Home, Users)
└── UsersLayout (submenu: All Users, Settings)
    └── Page content
```

### Navigation Behavior

When navigating between `/users` and `/users/settings`:

1. Both pages share `RootLayout` and `UsersLayout`
2. Only page content swaps (segment rendering)
3. Both layouts stay mounted
4. Active link highlighting updates via `useRequest()`

When navigating from `/users` to `/`:

1. `UsersLayout` unmounts
2. `RootLayout` stays mounted
3. Home page content replaces users section

### Active Link Highlighting

Use `useRequest()` to get current path:

```tsx
import { useRequest } from '../lib/ssr-hooks';

function NavLink({ href, children }) {
  const { path } = useRequest();
  const isActive = path === href || path.startsWith(href + '/');

  return (
    <Link href={href} style={isActive ? activeStyle : linkStyle}>
      {children}
    </Link>
  );
}
```

The context updates automatically during client-side navigation, triggering re-renders with the new path.

## Client Navigation

Layouts enable [segment rendering](/guide/navigation). Only changed portions swap on navigation.
