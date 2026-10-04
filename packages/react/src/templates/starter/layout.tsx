import { useState } from 'react';
import type { LayoutProps } from '@nestjs-ssr/react';
import { useCookie } from '@nestjs-ssr/react/client';

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
.app header, .app main, .app footer { max-width: 880px; margin: 0 auto; padding: 1.25rem 1.5rem; }
.app header { display: flex; align-items: center; justify-content: space-between; }
.app .brand { font-weight: 700; letter-spacing: -0.01em; color: var(--text); text-decoration: none; }
.app .toggle {
  font: inherit; font-size: 14px; cursor: pointer; color: var(--text);
  background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: .3rem .8rem;
}
.app footer { color: var(--muted); font-size: 14px; }
`;

type Theme = 'light' | 'dark';

/**
 * Root layout: wraps every page. Auto-discovered from src/views/layout.tsx.
 *
 * The theme choice is stored in a cookie so the server renders the right
 * theme on the first byte, with no flash. Without a choice, the page follows
 * the operating system through `prefers-color-scheme`.
 */
export default function RootLayout({ children }: LayoutProps) {
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

  return (
    <div className="app" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <header>
        <a className="brand" href="/welcome">
          NestJS + React
        </a>
        <button type="button" className="toggle" onClick={toggle}>
          {theme === 'dark' ? 'Light' : theme === 'light' ? 'Dark' : 'Theme'}
        </button>
      </header>
      <main>{children}</main>
      <footer>Rendered on the server by NestJS, hydrated by React.</footer>
    </div>
  );
}

RootLayout.displayName = 'RootLayout';
