/**
 * SSR <-> hydration parity: the invariant the five hydration bugs violated.
 *
 * `composeWithLayouts` (`../../react/navigation/compose-layouts.tsx`) is the
 * one wrap/nest loop now shared by all three render paths. This spec proves
 * the paths actually agree end to end by exercising each call site's own
 * name -> component resolution the way its real file does, then composing:
 *
 * - "server"  mirrors entry-server.tsx: layouts arrive already resolved to
 *   components (what `RenderInterceptor` hands it), straight into
 *   `composeWithLayouts`.
 * - "client"  mirrors entry-client.tsx: layout names are matched against a
 *   Vite-glob-shaped component registry via `buildComponentRegistry`.
 * - "segment" calls the real, unmodified `hydrateSegment` export (actual
 *   production code, including its own name resolution via
 *   `resolveViewComponent`), and reads back the DOM it produced.
 *
 * All three must render byte-identical markup for the same layout chain, or
 * the client's hydration tree disagrees with the HTML the server sent and
 * React throws a hydration mismatch. See
 * `openspec/changes/2026-08-15-ssr-regression-safety-net/proposal.md`.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { composeWithLayouts } from '../../react/navigation/compose-layouts';
import { hydrateSegment } from '../../react/navigation/hydrate-segment';
import {
  buildComponentRegistry,
  type ViewModuleRegistry,
} from '../../react/navigation/resolve-component';
import { PageContextProvider } from '../../react/hooks/use-page-context';
import type { RenderContext } from '../../interfaces/render-context.interface';
import type {
  AnyComponent,
  LayoutPropsData,
  PageData,
  ResolvedLayout,
} from '../../interfaces/component.interface';

// createRoot() only commits synchronously inside act(); segment hydration
// otherwise renders one tick later than this test reads the DOM.
beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

function Page({ title }: { title: string }) {
  return <div data-testid="page">{title}</div>;
}
Page.displayName = 'Page';

function RootLayout({
  children,
  layoutProps,
  context,
}: {
  children: React.ReactNode;
  layoutProps?: { banner?: string };
  context?: RenderContext;
}) {
  return (
    <div data-testid="root-layout" data-path={context?.path}>
      <span>{layoutProps?.banner}</span>
      {children}
    </div>
  );
}
RootLayout.displayName = 'RootLayout';

function ChildLayout({ children }: { children: React.ReactNode }) {
  return <div data-testid="child-layout">{children}</div>;
}
ChildLayout.displayName = 'ChildLayout';

/**
 * The server's reference to a third layout, declared with its real name —
 * Node isn't minified, so `getLayoutName` (`displayName || name`) sees
 * "MinifiedLayout" here regardless of whether the source sets `displayName`.
 */
function MinifiedLayout({ children }: { children: React.ReactNode }) {
  return <div data-testid="minified-layout">{children}</div>;
}
MinifiedLayout.displayName = 'MinifiedLayout';

/**
 * A *different* function object standing in for the client bundle's copy of
 * the very same layout: production minification renamed it and stripped any
 * name a minifier can reach, so `.name` no longer agrees with the server's
 * "MinifiedLayout" — only the file's normalized name still does (which is
 * why resolution below must still succeed via the filename tier, not the
 * name tier). This is the shape a real esbuild/Terser pass produces for a
 * component that never sets `displayName`.
 */
const minifiedClientLayout = (({ children }: { children: React.ReactNode }) => (
  <div data-testid="minified-layout">{children}</div>
)) as AnyComponent;
Object.defineProperty(minifiedClientLayout, 'name', { value: 'a' });

// A Vite `import.meta.glob`-shaped registry, as entry-client.tsx and
// hydrate-segment.tsx both see it.
const modules: ViewModuleRegistry = {
  '/src/views/page.tsx': { default: Page },
  '/src/views/root-layout.tsx': { default: RootLayout },
  '/src/views/child-layout.tsx': { default: ChildLayout },
  '/src/views/minified-layout.tsx': { default: minifiedClientLayout },
};

const LAYOUT_COMPONENTS: Record<string, AnyComponent> = {
  RootLayout,
  ChildLayout,
  MinifiedLayout,
};

const context: RenderContext = {
  url: '/x',
  path: '/x',
  query: {},
  params: {},
  method: 'GET',
};

const props: PageData = { title: 'Hello' };

interface LayoutChainEntry {
  name: string;
  props?: LayoutPropsData;
}

/** entry-server.tsx's world: the interceptor already resolved components. */
function toServerLayouts(chain: LayoutChainEntry[]): ResolvedLayout[] {
  return chain.map(({ name, props: layoutProps }) => ({
    layout: LAYOUT_COMPONENTS[name],
    props: layoutProps,
  }));
}

/**
 * entry-client.tsx's world: match each server-sent name against the
 * component registry it built from `import.meta.glob`. Copied from the
 * template's own matching logic (name, then normalized filename, then
 * lowercased filename, then carrying the server name onto the result) so
 * this test exercises the same resolution rule.
 */
function toClientLayouts(chain: LayoutChainEntry[]): ResolvedLayout[] {
  const componentMap = buildComponentRegistry(modules);
  const layouts: ResolvedLayout[] = [];
  for (const { name: layoutName, props: layoutProps } of chain) {
    const entry = componentMap.find(
      (c) =>
        c.name === layoutName ||
        c.normalizedFilename === layoutName ||
        c.filename === layoutName.toLowerCase(),
    );
    if (entry) {
      // Mirrors the real template: keep the server-sent name rather than
      // re-deriving one from the (possibly minified) resolved component.
      layouts.push({
        layout: entry.component,
        props: layoutProps || {},
        name: layoutName,
      });
    }
  }
  return layouts;
}

function renderServerPath(chain: LayoutChainEntry[]): string {
  const composed = composeWithLayouts(
    Page,
    props,
    toServerLayouts(chain),
    context,
  );
  return renderToString(
    <PageContextProvider context={context}>{composed}</PageContextProvider>,
  );
}

function renderClientPath(chain: LayoutChainEntry[]): string {
  const composed = composeWithLayouts(
    Page,
    props,
    toClientLayouts(chain),
    context,
  );
  return renderToString(
    <PageContextProvider context={context}>{composed}</PageContextProvider>,
  );
}

/** hydrate-segment.tsx's world: the real, unmodified export. */
function renderSegmentPath(chain: LayoutChainEntry[]): string {
  window.__MODULES__ = modules;
  window.__CONTEXT__ = context;
  const outlet = document.createElement('div');
  act(() => {
    hydrateSegment(outlet, 'Page', props, chain);
  });
  return outlet.querySelector('[data-segment-root]')!.innerHTML;
}

describe('SSR <-> hydration parity', () => {
  const scenarios: Array<{ name: string; chain: LayoutChainEntry[] }> = [
    { name: 'zero layouts', chain: [] },
    { name: 'one layout', chain: [{ name: 'RootLayout', props: {} }] },
    {
      name: 'nested layouts',
      chain: [
        { name: 'RootLayout', props: {} },
        { name: 'ChildLayout', props: {} },
      ],
    },
    {
      name: 'layout props',
      chain: [{ name: 'RootLayout', props: { banner: 'Top' } }],
    },
    {
      // Regression: entry-client.tsx used to re-derive each layout's
      // data-layout/data-outlet name from the resolved component's own
      // displayName/`.name` instead of keeping the server-sent name — fine
      // as long as a component's name survives production minification
      // intact, and silently wrong the moment it doesn't. `minifiedClientLayout`
      // resolves via the filename tier (so hydration still finds the right
      // component) but carries a `.name` ("a") that disagrees with what the
      // server rendered ("MinifiedLayout"); only propagating the server name
      // onto the client's `ResolvedLayout` (as `hydrate-segment.tsx` already
      // did) keeps this scenario passing.
      name: 'minified layout name',
      chain: [{ name: 'MinifiedLayout', props: {} }],
    },
  ];

  for (const { name, chain } of scenarios) {
    it(`${name}: server, client hydration, and segment navigation compose identical markup`, () => {
      const server = renderServerPath(chain);
      const client = renderClientPath(chain);
      const segment = renderSegmentPath(chain);

      expect(client).toBe(server);
      expect(segment).toBe(server);
    });
  }

  it("labels a minified layout with the server-sent name, not the resolved component's own", () => {
    const chain: LayoutChainEntry[] = [{ name: 'MinifiedLayout', props: {} }];

    const server = renderServerPath(chain);
    const client = renderClientPath(chain);

    // Both must carry the server's name on data-layout/data-outlet — never
    // "a", which is all `minifiedClientLayout.name` reveals after simulated
    // minification.
    expect(server).toContain('data-layout="MinifiedLayout"');
    expect(client).toContain('data-layout="MinifiedLayout"');
    expect(client).not.toContain('data-layout="a"');
  });

  it('carries context and layout props through all three paths identically', () => {
    const chain: LayoutChainEntry[] = [
      { name: 'RootLayout', props: { banner: 'Announcement' } },
    ];

    const server = renderServerPath(chain);
    expect(server).toContain('data-path="/x"');
    expect(server).toContain('Announcement');

    expect(renderClientPath(chain)).toBe(server);
    expect(renderSegmentPath(chain)).toBe(server);
  });
});
