# Layouts

Layouts let you wrap pages with shared UI like headers, footers, and navigation. NestJS SSR supports a powerful nested layout system with automatic discovery and type-safe props.

## Quick Start

Create a root layout that wraps all pages:

```tsx
// src/views/layout.tsx
import type { LayoutProps } from '@nestjs-ssr/react';

interface RootLayoutProps {
  lang?: string;
  theme?: string;
}

export default function RootLayout({
  children,
  layoutProps,
}: LayoutProps<RootLayoutProps>) {
  const lang = layoutProps?.lang || 'en';
  const theme = layoutProps?.theme || 'light';

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }
        html {
          font-size: 16px;
        }
      `}</style>
      <div className="root-layout" data-lang={lang} data-theme={theme}>
        {children}
      </div>
    </>
  );
}
```

That's it! This layout will automatically wrap all pages in your app.

## Layout Hierarchy

NestJS SSR supports four levels of layouts that compose together:

1. **Root Layout** - Auto-discovered, wraps everything
2. **Controller Layout** - Applied to all routes in a controller
3. **Method Layout** - Applied to specific routes
4. **Page Component** - The actual page content

### Example Hierarchy

```
RootLayout (global styles, html attributes)
└── MainLayout (header, footer)
    └── DashboardLayout (sidebar, tabs)
        └── DashboardPage (content)
```

Each layout wraps the next, creating a nested composition.

## Root Layout (Auto-Discovery)

The root layout is automatically discovered from conventional paths:

1. `src/views/layout.tsx` (recommended)
2. `src/views/layout/index.tsx`
3. `src/views/_layout.tsx`

**When to use:**
- Global styles and CSS resets
- HTML attributes (`lang`, `data-theme`)
- Global providers or context
- Analytics scripts

```tsx
// src/views/layout.tsx
import type { LayoutProps } from '@nestjs-ssr/react';

export default function RootLayout({ children, layoutProps }: LayoutProps) {
  return (
    <>
      <style>{`
        body {
          margin: 0;
          font-family: system-ui, sans-serif;
        }
      `}</style>
      <div id="app">
        {children}
      </div>
    </>
  );
}
```

The root layout is optional. If no file exists at these paths, pages render without it.

## Controller Layout

Apply a layout to all routes in a controller using the `@Layout` decorator:

```tsx
// src/layouts/main.layout.tsx
import type { LayoutProps } from '@nestjs-ssr/react';

interface MainLayoutProps {
  title?: string;
  subtitle?: string;
}

export default function MainLayout({
  children,
  layoutProps,
}: LayoutProps<MainLayoutProps>) {
  const title = layoutProps?.title || 'My App';

  return (
    <>
      <style>{`
        body {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
      `}</style>
      <div className="container">
        <header>
          <h1>{title}</h1>
        </header>
        <main>{children}</main>
        <footer>
          <p>&copy; 2024 My Company</p>
        </footer>
      </div>
    </>
  );
}
```

```typescript
// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Layout, Render } from '@nestjs-ssr/react';
import MainLayout from './layouts/main.layout';
import Home from './views/home';

@Controller()
@Layout(MainLayout)  // Applied to all routes
export class AppController {
  @Get()
  @Render(Home)
  getHome() {
    return { message: 'Hello' };
  }

  @Get('about')
  @Render(About)
  getAbout() {
    return { message: 'About us' };
  }
}
```

Both routes (`/` and `/about`) will use `MainLayout`.

## Method Layout

Override or add a layout for specific routes using the `@Render` decorator:

```tsx
// src/views/layouts/dashboard.layout.tsx
import type { LayoutProps } from '@nestjs-ssr/react';

interface DashboardLayoutProps {
  activeTab?: string;
}

export default function DashboardLayout({
  children,
  layoutProps,
}: LayoutProps<DashboardLayoutProps>) {
  const activeTab = layoutProps?.activeTab || 'overview';

  return (
    <div style={{ padding: '2rem' }}>
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <nav>
          {['overview', 'analytics', 'settings'].map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
```

```typescript
import { Controller, Get } from '@nestjs/common';
import { Layout, Render } from '@nestjs-ssr/react';
import MainLayout from './layouts/main.layout';
import DashboardLayout from './views/layouts/dashboard.layout';
import Dashboard from './views/dashboard';

@Controller()
@Layout(MainLayout)
export class AppController {
  @Get('dashboard')
  @Render(Dashboard, {
    layout: DashboardLayout,
    layoutProps: { activeTab: 'overview' }
  })
  getDashboard() {
    return { stats: { users: 1234 } };
  }
}
```

This creates: `RootLayout > MainLayout > DashboardLayout > Dashboard`

## Layout Props

Layouts receive props through three mechanisms, merged with increasing priority:

### 1. Static Props from `@Layout` Decorator

```typescript
@Controller()
@Layout(MainLayout, { title: 'My App' })
export class AppController {
  // All routes get { title: 'My App' }
}
```

### 2. Static Props from `@Render` Decorator

```typescript
@Get('dashboard')
@Render(Dashboard, {
  layout: DashboardLayout,
  layoutProps: { activeTab: 'overview' }
})
getDashboard() {
  // Dashboard route gets { activeTab: 'overview' }
}
```

### 3. Dynamic Props from Return Value

```typescript
@Get('dashboard')
@Render(Dashboard, { layout: DashboardLayout })
getDashboard() {
  const user = { name: 'John', role: 'Admin' };

  return {
    props: { stats: { users: 1234 } },
    layoutProps: {
      title: `${user.name}'s Dashboard`,  // Dynamic!
      subtitle: `Role: ${user.role}`,
      lastUpdated: new Date().toISOString(),
    },
  };
}
```

**Merge Priority:**
```
Static @Layout props  <  Static @Render props  <  Dynamic return props
      (lowest)                                        (highest)
```

All layouts in the hierarchy receive the merged props.

## Disabling Layouts

### Skip All Layouts

Use `layout: null` to render without any layouts:

```typescript
@Get('raw')
@Render(RawComponent, { layout: null })
getRaw() {
  return { data: 'No layouts' };
}
```

Result: `RootLayout > RawComponent` (only root layout)

### Skip Controller Layout

Use `layout: false` to skip the controller layout but keep others:

```typescript
@Controller()
@Layout(MainLayout)
export class AppController {
  @Get('minimal')
  @Render(MinimalPage, { layout: false })
  getMinimal() {
    return { data: 'Minimal' };
  }
}
```

Result: `RootLayout > MinimalPage` (skips MainLayout)

## Type Safety

Define layout prop interfaces for type safety:

```tsx
import type { LayoutProps } from '@nestjs-ssr/react';

interface MainLayoutProps {
  title: string;
  subtitle?: string;
  showNav?: boolean;
}

export default function MainLayout({
  children,
  layoutProps,
}: LayoutProps<MainLayoutProps>) {
  // layoutProps is typed as MainLayoutProps | undefined
  const { title, subtitle, showNav = true } = layoutProps || {};

  return (
    <div>
      <header>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {showNav && <nav>...</nav>}
      <main>{children}</main>
    </div>
  );
}
```

TypeScript will validate prop types when you pass `layoutProps`.

## Client-Side Access

Layout metadata is available on the client via `window.__LAYOUTS__`:

```typescript
// Client-side code
const layouts = window.__LAYOUTS__;
// [
//   { name: 'RootLayout', props: { lang: 'en' } },
//   { name: 'MainLayout', props: { title: 'Dashboard' } },
//   { name: 'DashboardLayout', props: { activeTab: 'overview' } }
// ]
```

This enables client-side routing with consistent layouts.

## Best Practices

### 1. Keep Layouts Pure

Layouts should not fetch data or have side effects:

```tsx
// ❌ Don't fetch in layouts
export default function BadLayout({ children }: LayoutProps) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/user').then(r => r.json()).then(setUser);
  }, []);

  return <div>...</div>;
}

// ✅ Pass data via layoutProps
export default function GoodLayout({ children, layoutProps }: LayoutProps) {
  const user = layoutProps?.user;
  return <div>{user?.name}</div>;
}
```

### 2. Use Semantic Nesting

Each layout level should have a clear purpose:

- **Root**: Global styles, HTML attributes, providers
- **Controller**: Shared UI for a feature (header, footer)
- **Method**: Route-specific UI (tabs, sidebars)
- **Page**: Content

### 3. Prefer Convention Over Configuration

Use the auto-discovered root layout instead of manually wrapping every page.

### 4. Colocate Layouts with Features

Keep layouts near the components that use them:

```
src/
├── views/
│   ├── layout.tsx              # Root layout
│   └── layouts/
│       └── main.layout.tsx     # Shared layouts
└── features/
    └── dashboard/
        ├── dashboard.controller.ts
        ├── views/
        │   ├── dashboard.tsx
        │   └── dashboard.layout.tsx  # Feature-specific
```

## Examples

### Full Hierarchy Example

```tsx
// src/views/layout.tsx (Root)
export default function RootLayout({ children }: LayoutProps) {
  return (
    <>
      <style>{`body { margin: 0; }`}</style>
      {children}
    </>
  );
}
```

```tsx
// src/views/layouts/main.layout.tsx (Controller)
export default function MainLayout({ children, layoutProps }: LayoutProps) {
  return (
    <div>
      <header>
        <h1>{layoutProps?.title || 'App'}</h1>
      </header>
      <main>{children}</main>
      <footer>&copy; 2024</footer>
    </div>
  );
}
```

```tsx
// src/views/layouts/dashboard.layout.tsx (Method)
export default function DashboardLayout({ children, layoutProps }: LayoutProps) {
  return (
    <div className="dashboard">
      <aside>Sidebar</aside>
      <div className="content">
        <h2>Dashboard</h2>
        {children}
      </div>
    </div>
  );
}
```

```typescript
// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Layout, Render } from '@nestjs-ssr/react';
import MainLayout from './views/layouts/main.layout';
import DashboardLayout from './views/layouts/dashboard.layout';
import Dashboard from './views/dashboard';

@Controller()
@Layout(MainLayout, { title: 'My App' })
export class AppController {
  @Get('dashboard')
  @Render(Dashboard, {
    layout: DashboardLayout,
    layoutProps: { activeTab: 'overview' }
  })
  getDashboard() {
    const user = { name: 'John' };

    return {
      props: { stats: { users: 1234 } },
      layoutProps: {
        title: `${user.name}'s Dashboard`,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}
```

**Result:**
```
RootLayout
└── MainLayout (title: "John's Dashboard")
    └── DashboardLayout (activeTab: "overview", lastUpdated: "...")
        └── Dashboard (stats: { users: 1234 })
```

## Next Steps

- [Head Tags](/guide/head-tags) - Add SEO meta tags
- [Development Setup](/guide/development-setup) - Configure HMR
- [API Reference](/reference/api) - Complete API docs
