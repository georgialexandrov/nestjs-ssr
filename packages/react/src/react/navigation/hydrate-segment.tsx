import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PageContextProvider } from '../hooks/use-page-context';
import { resolveViewComponent } from './resolve-component';
import type { RenderContext } from '../../interfaces/render-context.interface';
import type {
  AnyComponent,
  PageData,
  SerializedLayout,
  ViewModule,
} from '../../interfaces/component.interface';

// Track React roots by outlet element for cleanup
const rootRegistry = new WeakMap<Element, Root>();

/**
 * Hydrate a segment after client-side navigation.
 * Uses the global module registry from entry-client.tsx to resolve the component.
 *
 * Note: We use createRoot instead of hydrateRoot because after innerHTML swap,
 * the content is fresh and we need a new React tree. We track roots to properly
 * unmount before creating new ones on the same container.
 */
export function hydrateSegment(
  outlet: Element,
  componentName: string,
  props: PageData,
  layouts?: SerializedLayout[],
): void {
  // Get module registry (set by entry-client.tsx)
  const modules = window.__MODULES__;
  if (!modules) {
    console.warn(
      '[navigation] Module registry not available for segment hydration. ' +
        'Make sure entry-client.tsx exports window.__MODULES__.',
    );
    return;
  }

  // Resolve component using the shared resolver (same logic as entry-client.tsx)
  const ViewComponent = resolveViewComponent(componentName, modules);
  if (!ViewComponent) {
    console.warn(
      `[navigation] Component "${componentName}" not found for hydration. ` +
        'Available components: ' +
        Object.keys(modules)
          .map((path) => {
            const c = modules[path].default;
            return c?.displayName || c?.name || 'anonymous';
          })
          .join(', '),
    );
    return;
  }

  // Get current context (should already be updated by navigate()).
  // The fallback only matters when hydrateSegment is driven directly; derive a
  // real context from the URL rather than an empty object, so a component
  // reading path or query during segment hydration sees the current location
  // instead of undefined.
  const context: RenderContext = window.__CONTEXT__ ?? {
    url: window.location.href,
    path: window.location.pathname,
    query: Object.fromEntries(new URLSearchParams(window.location.search)),
    params: {},
    method: 'GET',
  };

  // Compose with layouts if provided (for nested layouts below swap target)
  const composedElement = composeWithLayouts(
    ViewComponent,
    props,
    layouts || [],
    context,
    modules,
  );

  // Create the React element
  // isSegment=true prevents this provider from overwriting the root provider's setter
  const element = (
    <PageContextProvider context={context} isSegment>
      {composedElement}
    </PageContextProvider>
  );

  // The outlet already contains server-rendered HTML from the segment response.
  // We need to hydrate it, but since the outlet is part of the parent React tree,
  // we create an isolated wrapper to avoid conflicts.

  // Find or create our hydration wrapper inside the outlet
  let wrapper = outlet.querySelector('[data-segment-root]');

  if (wrapper) {
    // Cleanup existing root before re-hydrating
    const existingRoot = rootRegistry.get(wrapper);
    if (existingRoot) {
      existingRoot.unmount();
      rootRegistry.delete(wrapper);
    }
  }

  // Create fresh wrapper for isolation from parent React tree
  wrapper = document.createElement('div');
  wrapper.setAttribute('data-segment-root', 'true');
  outlet.innerHTML = '';
  outlet.appendChild(wrapper);

  // Create and render the React tree
  const root = createRoot(wrapper);
  root.render(element);
  rootRegistry.set(wrapper, root);
}

/**
 * Compose a component with layouts.
 * This must match the server-side composition in entry-server.tsx,
 * including the data-layout and data-outlet wrapper divs.
 *
 * The layouts array is ordered [OuterLayout, InnerLayout] (outer to inner).
 * We iterate in REVERSE order because wrapping happens inside-out:
 * - Start with Page
 * - Wrap with innermost layout first
 * - Then wrap with outer layouts
 */
function composeWithLayouts(
  ViewComponent: AnyComponent,
  props: PageData,
  layouts: SerializedLayout[],
  context: RenderContext,
  modules: Record<string, ViewModule>,
): React.ReactElement {
  // Start with the page component
  let result = <ViewComponent {...props} />;

  // Wrap with each layout in REVERSE order (innermost to outermost)
  // This produces the correct nesting: OuterLayout > InnerLayout > Page
  for (let i = layouts.length - 1; i >= 0; i--) {
    const { name: layoutName, props: layoutProps } = layouts[i];
    const Layout = resolveViewComponent(layoutName, modules);
    if (!Layout) {
      console.warn(
        `[navigation] Layout "${layoutName}" not found for hydration`,
      );
      continue;
    }

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
