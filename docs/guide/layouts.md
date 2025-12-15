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

Three sources, merged by priority:

```typescript
// 1. Controller decorator (lowest)
@Layout(MainLayout, { props: { title: 'App' } })

// 2. Method decorator
@Render(Page, { layoutProps: { subtitle: 'Home' } })

// 3. Return value (highest)
return {
  data: { ... },
  layoutProps: { title: 'Dynamic Title' }
};
```

Layouts receive merged props:

```tsx
export default function MainLayout({ children, layoutProps }: LayoutProps) {
  return (
    <div>
      <h1>{layoutProps?.title}</h1>
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

## Client Navigation

Layouts enable [segment rendering](/guide/navigation). Only changed portions swap on navigation.
