import { useState } from 'react';
import type { LayoutProps } from '@nestjs-ssr/react';
import { Link, useCookie, useNavigationState } from '@nestjs-ssr/react/client';
import { useRequest, useUser } from '../lib/ssr-hooks.js';

// The same design tokens and theme handling as the starter `init` creates
// (src/templates/starter/layout.tsx), so the example and a new app match.
// Styles live in the layout rather than a .css import: views are also
// compiled by the Nest build, where a CSS import would not resolve.
const styles = `
html, body { margin: 0; }
.app {
  --bg: #ffffff; --surface: #f6f7f9; --text: #16181d; --muted: #5b6270;
  --border: #e3e6eb; --accent: #e0234e; --accent-contrast: #ffffff;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  .app:not([data-theme='light']) {
    --bg: #0f1115; --surface: #171a21; --text: #e8eaee; --muted: #9aa3b2;
    --border: #262b35; --accent: #ff4d6d; --accent-contrast: #0f1115;
    color-scheme: dark;
  }
}
.app[data-theme='dark'] {
  --bg: #0f1115; --surface: #171a21; --text: #e8eaee; --muted: #9aa3b2;
  --border: #262b35; --accent: #ff4d6d; --accent-contrast: #0f1115;
  color-scheme: dark;
}
.app {
  min-height: 100vh; margin: 0; background: var(--bg); color: var(--text);
  font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
.app * { box-sizing: border-box; }
.app a { color: var(--accent); }
.app header, .app main, .app footer { max-width: 960px; margin: 0 auto; padding: 1.25rem 1.5rem; }
.app header { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
.app .brand { font-weight: 700; letter-spacing: -0.01em; color: var(--text); text-decoration: none; }
.app header nav { display: flex; gap: .25rem; }
.app header nav a { color: var(--muted); text-decoration: none; padding: .35rem .75rem; border-radius: 999px; }
.app header nav a[aria-current='page'] { color: var(--text); background: var(--surface); }
.app .status { font-size: 14px; color: var(--muted); }
.app .end { margin-left: auto; display: flex; align-items: center; gap: .75rem; font-size: 14px; }
.app .role {
  text-transform: uppercase; font-size: 12px; letter-spacing: .04em;
  background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: .1rem .5rem;
}
.app .toggle {
  font: inherit; font-size: 14px; cursor: pointer; color: var(--text);
  background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: .3rem .8rem;
}
.app footer { color: var(--muted); font-size: 14px; border-top: 1px solid var(--border); }
`;

type Theme = 'light' | 'dark';

/**
 * Root layout: wraps every page. Auto-discovered from src/views/layout.tsx.
 *
 * The theme choice is stored in a cookie (allowlisted in app.module.ts) so
 * the server renders the right theme on the first byte, with no flash.
 * Without a choice, the page follows the operating system.
 */
export default function RootLayout({ children }: LayoutProps) {
  const navState = useNavigationState();
  const { path } = useRequest();
  const user = useUser();
  const saved = useCookie('theme');
  const [theme, setTheme] = useState<Theme | undefined>(
    saved === 'dark' || saved === 'light' ? saved : undefined,
  );

  const toggle = () => {
    const current =
      theme ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light');
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  };

  const current = (href: string) =>
    (href === '/' ? path === '/' : path.startsWith(href)) ? 'page' : undefined;

  return (
    <div className="app" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <header>
        <Link href="/" className="brand">
          🍳 NestRecipes
        </Link>

        <nav>
          <Link href="/" aria-current={current('/')}>
            Home
          </Link>
          <Link href="/recipes" prefetch aria-current={current('/recipes')}>
            Recipes
          </Link>
          <Link href="/specials" prefetch aria-current={current('/specials')}>
            Specials
          </Link>
        </nav>

        {navState === 'loading' && <span className="status">Loading…</span>}

        <div className="end">
          {/* The context projector in app.module.ts sends only the user's id
              and name to the browser; the role stays on the server. */}
          {user?.role && <span className="role">{user.role}</span>}
          {user && <span>{user.name}</span>}
          <button type="button" className="toggle" onClick={toggle}>
            {theme === 'dark' ? 'Light' : theme === 'light' ? 'Dark' : 'Theme'}
          </button>
        </div>
      </header>

      <main>{children}</main>

      <footer>
        Built with @nestjs-ssr/react. Controllers return data, components render
        it.
      </footer>
    </div>
  );
}

RootLayout.displayName = 'RootLayout';
