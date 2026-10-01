import React from 'react';
import type {
  AnyComponent,
  PageData,
  ResolvedLayout,
} from '../../interfaces/component.interface';
import type { RenderContext } from '../../interfaces/render-context.interface';

/**
 * Wrap a page component with its already-resolved layout chain.
 *
 * This is the single algorithm behind every render path that produces
 * layout markup: the initial SSR pass (`entry-server.tsx`), full-page
 * hydration (`entry-client.tsx`), and client-side segment navigation
 * (`hydrate-segment.tsx`). Each call site resolves layout names to
 * components its own way — the server already holds component references,
 * the client matches names against the Vite-bundled module registry — but
 * all three must nest the result identically, or the client's hydration
 * tree diverges from the HTML the server sent and React throws a hydration
 * mismatch. Five separate bugs came from three drifting copies of this
 * loop (see `openspec/changes/2026-08-15-ssr-regression-safety-net`); there
 * is now exactly one.
 *
 * `layouts` is ordered outer to inner, e.g. `[RootLayout, ControllerLayout,
 * MethodLayout]`. Wrapping happens inside-out, so the loop walks the array
 * in reverse: start from the page, wrap with the innermost layout first,
 * and finish with the outermost. Each layout gets a `data-layout` attribute
 * and its children are wrapped in a matching `data-outlet` div, which
 * client-side navigation uses to find the node to swap.
 *
 * A layout's `name` (used for both attributes) is taken from
 * {@link ResolvedLayout.name} when the caller already knows it — segment
 * navigation reuses the exact string the server put in the SSR HTML,
 * because re-deriving it from the client's (possibly differently minified)
 * component could disagree with what the server sent. Otherwise it falls
 * back to `displayName || name || 'Layout'`, computed from the component
 * itself.
 */
export function composeWithLayouts(
  ViewComponent: AnyComponent,
  props: PageData,
  layouts: ResolvedLayout[] = [],
  context?: RenderContext,
): React.ReactElement {
  // Start with the page component
  let result = <ViewComponent {...props} />;

  // Wrap with each layout in REVERSE order (innermost to outermost), so the
  // final nesting is RootLayout > ControllerLayout > ... > Page.
  for (let i = layouts.length - 1; i >= 0; i--) {
    const { layout: Layout, props: layoutProps, name } = layouts[i];
    const layoutName = name ?? (Layout.displayName || Layout.name || 'Layout');
    result = (
      <div data-layout={layoutName}>
        <Layout context={context} layoutProps={layoutProps}>
          <div data-outlet={layoutName}>{result}</div>
        </Layout>
      </div>
    );
  }

  return result;
}
