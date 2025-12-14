/// <reference types="@nestjs-ssr/react/global" />
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import {
  PageContextProvider,
  NavigationProvider,
} from '@nestjs-ssr/react/client';

const componentName = window.__COMPONENT_NAME__;
const initialProps = window.__INITIAL_STATE__ || {};
const renderContext = window.__CONTEXT__ || {};
const layoutsData = window.__LAYOUTS__ || [];

// Auto-import all view components using Vite's glob feature
// Exclude entry-client.tsx and entry-server.tsx from the glob
// Use relative path (./) to ensure glob resolves from this file's directory
// @ts-ignore - Vite-specific API
const modules: Record<string, { default: React.ComponentType<any> }> =
  import.meta.glob(['./**/*.tsx', '!./entry-*.tsx'], {
    eager: true,
  });

// Export modules globally for segment hydration after client-side navigation
window.__MODULES__ = modules;

// Build a map of components with their metadata
// Filter out entry files and modules without default exports
const componentMap = Object.entries(modules)
  .filter(([path, module]) => {
    // Skip entry-client and entry-server files
    const filename = path.split('/').pop();
    if (filename === 'entry-client.tsx' || filename === 'entry-server.tsx') {
      return false;
    }
    // Only include modules with a default export
    return module.default !== undefined;
  })
  .map(([path, module]) => {
    const component = module.default;
    const name = component.displayName || component.name;
    const filename = path.split('/').pop()?.replace('.tsx', '');
    const normalizedFilename = filename
      ? filename.charAt(0).toUpperCase() + filename.slice(1)
      : undefined;

    return { path, component, name, filename, normalizedFilename };
  });

// Find the component by matching in this order:
// 1. Exact match by displayName or function name
// 2. Match by normalized filename (e.g., "home.tsx" -> "Home")
// 3. For minified names (default_N), match the Nth component with name "default"
// 4. If only one component exists, use it (regardless of name)
let ViewComponent: React.ComponentType<any> | undefined;

// Try exact name match first
ViewComponent = componentMap.find(
  (c) =>
    c.name === componentName ||
    c.normalizedFilename === componentName ||
    c.filename === componentName.toLowerCase(),
)?.component;

// If no match found and component name looks like a generic/minified name (default, default_1, etc.)
if (!ViewComponent && /^default(_\d+)?$/.test(componentName)) {
  // If there's only one component, use it regardless of name
  if (componentMap.length === 1) {
    ViewComponent = componentMap[0].component;
  } else {
    // Handle minified anonymous functions: default_1, default_2, etc.
    // Extract the index from the name (default_1 -> 1, default_2 -> 2, default -> 0)
    const match = componentName.match(/^default_(\d+)$/);
    const index = match ? parseInt(match[1], 10) - 1 : 0;

    // Get all components with name "default" (anonymous functions), sorted by path for consistency
    const defaultComponents = componentMap
      .filter((c) => c.name === 'default')
      .sort((a, b) => a.path.localeCompare(b.path));

    // Try to match by index
    if (defaultComponents[index]) {
      ViewComponent = defaultComponents[index].component;
    }
  }
}

if (!ViewComponent) {
  const availableComponents = Object.entries(modules)
    .map(([path, m]) => {
      const filename = path.split('/').pop()?.replace('.tsx', '');
      const name = m.default.displayName || m.default.name;
      return `${filename} (${name})`;
    })
    .join(', ');
  throw new Error(
    `Component "${componentName}" not found in views directory. Available: ${availableComponents}`,
  );
}

/**
 * Find a layout component by name in the modules registry.
 * Matches by displayName, function name, or normalized filename.
 */
function findLayoutComponent(
  layoutName: string,
): React.ComponentType<any> | undefined {
  return componentMap.find(
    (c) =>
      c.name === layoutName ||
      c.normalizedFilename === layoutName ||
      c.filename === layoutName.toLowerCase(),
  )?.component;
}

/**
 * Compose a component with layouts from window.__LAYOUTS__.
 * This must match the server-side composition in entry-server.tsx,
 * including the data-layout and data-outlet wrapper divs.
 */
function composeWithLayouts(
  ViewComponent: React.ComponentType<any>,
  props: any,
  layouts: Array<{ name: string; props?: any }>,
): React.ReactElement {
  // Start with the page component
  let result = <ViewComponent {...props} />;

  // Wrap with each layout in the chain (same order as server)
  // Each layout gets data-layout attribute and children are wrapped in data-outlet
  for (const { name: layoutName, props: layoutProps } of layouts) {
    const Layout = findLayoutComponent(layoutName);
    if (!Layout) {
      console.warn(`Layout "${layoutName}" not found in modules registry`);
      continue;
    }

    result = (
      <div data-layout={layoutName}>
        <Layout context={renderContext} layoutProps={layoutProps}>
          <div data-outlet={layoutName}>{result}</div>
        </Layout>
      </div>
    );
  }

  return result;
}

// Compose the component with layouts from server (using __LAYOUTS__ data)
const composedElement = composeWithLayouts(
  ViewComponent,
  initialProps,
  layoutsData,
);

// Wrap with providers to make context and navigation state available via hooks
const wrappedElement = (
  <NavigationProvider>
    <PageContextProvider context={renderContext}>
      {composedElement}
    </PageContextProvider>
  </NavigationProvider>
);

hydrateRoot(document.getElementById('root')!, wrappedElement);

// Handle browser back/forward navigation
window.addEventListener('popstate', async () => {
  // Dynamically import navigate to avoid circular dependency with hydrate-segment
  const { navigate } = await import('@nestjs-ssr/react/client');
  // Re-navigate to the current URL (browser already updated location)
  navigate(location.href, { replace: true, scroll: false });
});
