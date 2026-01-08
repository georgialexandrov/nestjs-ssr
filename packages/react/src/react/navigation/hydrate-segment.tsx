import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PageContextProvider } from '../hooks/use-page-context';

// Track React roots by outlet element for cleanup
const rootRegistry = new WeakMap<Element, Root>();

/**
 * Layout metadata for segment hydration
 */
interface LayoutInfo {
  name: string;
  props?: any;
}

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
  props: any,
  layouts?: LayoutInfo[],
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

  // Resolve component using same logic as entry-client.tsx
  const ViewComponent = resolveComponent(componentName, modules);
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

  // Get current context (should already be updated by navigate())
  const context = window.__CONTEXT__ || {};

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
  ViewComponent: React.ComponentType<any>,
  props: any,
  layouts: LayoutInfo[],
  context: any,
  modules: Record<string, { default: React.ComponentType<any> }>,
): React.ReactElement {
  // Start with the page component
  let result = <ViewComponent {...props} />;

  // Wrap with each layout in REVERSE order (innermost to outermost)
  // This produces the correct nesting: OuterLayout > InnerLayout > Page
  for (let i = layouts.length - 1; i >= 0; i--) {
    const { name: layoutName, props: layoutProps } = layouts[i];
    const Layout = resolveComponent(layoutName, modules);
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

/**
 * Resolve a component from the module registry by name.
 * Uses the same resolution logic as entry-client.tsx.
 */
function resolveComponent(
  name: string,
  modules: Record<string, { default: React.ComponentType<any> }>,
): React.ComponentType<any> | undefined {
  // Build component map (same as entry-client.tsx)
  const componentMap = Object.entries(modules)
    .filter(([path, module]) => {
      const filename = path.split('/').pop();
      if (filename === 'entry-client.tsx' || filename === 'entry-server.tsx') {
        return false;
      }
      return module.default !== undefined;
    })
    .map(([path, module]) => {
      const component = module.default;
      const componentName = component.displayName || component.name;
      const filename = path.split('/').pop()?.replace('.tsx', '');
      const normalizedFilename = filename
        ? filename.charAt(0).toUpperCase() + filename.slice(1)
        : undefined;
      return { component, name: componentName, filename, normalizedFilename };
    });

  // Try exact name match first
  let match = componentMap.find(
    (c) =>
      c.name === name ||
      c.normalizedFilename === name ||
      c.filename === name.toLowerCase(),
  );

  // Handle minified names (default, default_1, etc.)
  if (!match && /^default(_\d+)?$/.test(name)) {
    if (componentMap.length === 1) {
      match = componentMap[0];
    } else {
      // Extract index from name (default_1 -> 0, default_2 -> 1, etc.)
      const indexMatch = name.match(/^default_(\d+)$/);
      const index = indexMatch ? parseInt(indexMatch[1], 10) - 1 : 0;

      const defaultComponents = componentMap
        .filter((c) => c.name === 'default')
        .sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));

      if (defaultComponents[index]) {
        match = defaultComponents[index];
      }
    }
  }

  return match?.component;
}
