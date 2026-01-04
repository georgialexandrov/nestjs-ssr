# Tailwind CSS

Style your SSR pages with Tailwind CSS.

## Installation

**1. Install dependencies**

```bash
pnpm add tailwindcss @tailwindcss/vite
```

**2. Update vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // ... rest of your config
});
```

**3. Create src/views/styles.css**

```css
@import 'tailwindcss';
```

**4. Create src/views/layout.tsx**

Import the CSS in your root layout so it loads on every page:

```tsx
import type { LayoutProps } from '@nestjs-ssr/react';
import { ReactNode } from 'react';
import './styles.css';

interface PageLayoutProps extends LayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children, context }: PageLayoutProps) {
  return (
    <div>
      <header>Header</header>
      <main>{children}</main>
    </div>
  );
}

RootLayout.displayName = 'RootLayout';
```

::: tip
The `displayName` is required for production builds where function names get minified.
:::

## Usage

Use Tailwind classes in your components:

```tsx
export default function HomePage({ data }: PageProps<Props>) {
  return (
    <div className="min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-blue-600">Welcome</h1>
    </div>
  );
}
```

## Why Import in Layout?

The root layout wraps all pages, so importing CSS there ensures:

- Styles load once and apply everywhere
- No duplicate imports across pages
- CSS is included in both SSR and client hydration
