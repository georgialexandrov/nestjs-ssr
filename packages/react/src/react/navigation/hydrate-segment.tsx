import { createRoot, type Root } from 'react-dom/client';
import { PageContextProvider } from '../hooks/use-page-context';
import { resolveViewComponent } from './resolve-component';
import { composeWithLayouts } from './compose-layouts';
import { clearElement } from './dom-update-adapter';
import type { RenderContext } from '../../interfaces/render-context.interface';
import type {
  PageData,
  ResolvedLayout,
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

  // Compose with layouts if provided (for nested layouts below swap target).
  // Each layout is resolved by name here (this call site's own resolution),
  // then handed to the shared composer that also backs entry-server.tsx and
  // entry-client.tsx.
  const composedElement = composeWithLayouts(
    ViewComponent,
    props,
    resolveLayouts(layouts || [], modules),
    context,
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
  // Emptying goes through the DOM adapter so this file never touches an HTML
  // injection sink; all segment markup is written in one place.
  clearElement(outlet);
  outlet.appendChild(wrapper);

  // Create and render the React tree
  const root = createRoot(wrapper);
  root.render(element);
  rootRegistry.set(wrapper, root);
}

/**
 * Resolve each serialized layout's name to a component via the shared
 * view-module resolver, dropping (and warning about) any that no longer
 * resolve. The server-supplied `name` is kept on the result so the shared
 * composer stamps the exact string the server already committed to the SSR
 * HTML onto `data-layout`/`data-outlet`, instead of re-deriving it from this
 * (possibly differently minified) client bundle.
 */
function resolveLayouts(
  layouts: SerializedLayout[],
  modules: Record<string, ViewModule>,
): ResolvedLayout[] {
  const resolved: ResolvedLayout[] = [];
  for (const { name: layoutName, props: layoutProps } of layouts) {
    const Layout = resolveViewComponent(layoutName, modules);
    if (!Layout) {
      console.warn(
        `[navigation] Layout "${layoutName}" not found for hydration`,
      );
      continue;
    }
    resolved.push({ layout: Layout, props: layoutProps, name: layoutName });
  }
  return resolved;
}
