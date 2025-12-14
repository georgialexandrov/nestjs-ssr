# Navigation

Segment rendering. Only the changed portion fetches and swaps. No full reloads.

## Link

```tsx
import { Link } from '@nestjs-ssr/react/client';

<Link href="/products">Products</Link>
<Link href="/about" replace>About</Link>
<Link href="/settings" scroll={false}>Settings</Link>
```

| Prop      | Type    | Default | Description                    |
| --------- | ------- | ------- | ------------------------------ |
| `href`    | string  | —       | Target URL                     |
| `replace` | boolean | false   | replaceState vs pushState      |
| `scroll`  | boolean | true    | Scroll to top after navigation |

Renders as `<a>` with click handler. Works without JavaScript (falls back to normal link).

## navigate()

Programmatic navigation:

```typescript
import { navigate } from '@nestjs-ssr/react/client';

await navigate('/dashboard');
await navigate('/settings', { replace: true, scroll: false });
```

Returns a Promise. Resolves after hydration completes.

## useNavigationState

Loading state for spinners:

```tsx
import { useNavigationState } from '@nestjs-ssr/react/client';

function Nav() {
  const state = useNavigationState(); // 'idle' | 'loading'
  return state === 'loading' ? <Spinner /> : null;
}
```

## How It Works

1. Click `Link` or call `navigate()`
2. Read `data-layout` attributes from DOM
3. Fetch with `X-Current-Layouts` header
4. Server returns `{ html, swapTarget, props }`
5. Swap content in matching `data-outlet`
6. Hydrate new segment
7. Update history and head

## Layout Markers

Server renders with data attributes:

```html
<div data-layout="RootLayout">
  <div data-outlet="RootLayout">
    <div data-layout="AdminLayout">
      <div data-outlet="AdminLayout">
        <!-- page content -->
      </div>
    </div>
  </div>
</div>
```

Navigation swaps the smallest changed segment.

## displayName Required

Set `displayName` on layouts. Production builds minify function names.

```tsx
export default function RootLayout({ children }: LayoutProps) {
  return <div>{children}</div>;
}

RootLayout.displayName = 'RootLayout';
```

Without it, layout detection breaks in production. Names become `default` or `e`.

## View Transitions

Uses View Transitions API when available:

```css
::view-transition-old(root) {
  animation: fade-out 150ms ease-out;
}

::view-transition-new(root) {
  animation: fade-in 150ms ease-in;
}
```

Falls back to instant swap.

## Fallbacks

Full page navigation when:

- No layouts in DOM
- No common ancestor layout
- Fetch fails
- JavaScript disabled

Always works. Progressive enhancement.
