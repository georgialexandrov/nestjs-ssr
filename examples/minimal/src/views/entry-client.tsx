/// <reference types="@nestjs-ssr/react/global" />

import React, { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import {
  PageContextProvider,
  NavigationProvider,
} from '@nestjs-ssr/react/client';

const componentName = window.__COMPONENT_NAME__;
const initialProps = window.__INITIAL_STATE__ || {};
const renderContext = window.__CONTEXT__ || {};

/** Convert kebab-case filename to PascalCase (e.g., "login-page" → "LoginPage") */
function toPascalCase(str: string): string {
  return str.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase());
}

// Auto-discover root layout using Vite's glob import (must match server-side discovery)
// @ts-ignore - Vite-specific API
const layoutModules = import.meta.glob('@/views/layout.tsx', {
  eager: true,
}) as Record<string, { default: React.ComponentType<any> }>;

const layoutPath = Object.keys(layoutModules)[0];
const RootLayout = layoutPath ? layoutModules[layoutPath].default : null;

// Auto-import all view components using Vite's glob feature
// Exclude entry-client.tsx and entry-server.tsx from the glob
// @ts-ignore - Vite-specific API
const modules: Record<string, { default: React.ComponentType<any> }> =
  import.meta.glob(['@/views/**/*.tsx', '!@/views/entry-*.tsx'], {
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
    const normalizedFilename = filename ? toPascalCase(filename) : undefined;

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
 * Check if a component has a layout property
 */
function hasLayout(
  component: any,
): component is { layout: React.ComponentType<any>; layoutProps?: any } {
  return component && typeof component.layout === 'function';
}

/**
 * Compose a component with its layout (and nested layouts if any).
 * This must match the server-side composition in entry-server.tsx.
 *
 * The layouts array is ordered [RootLayout, ControllerLayout, MethodLayout] (outer to inner).
 * We iterate in REVERSE order because wrapping happens inside-out:
 * - Start with Page
 * - Wrap with innermost layout first (MethodLayout)
 * - Then wrap with ControllerLayout
 * - Finally wrap with RootLayout (outermost)
 */
function composeWithLayout(
  ViewComponent: React.ComponentType<any>,
  props: any,
  context?: any,
  layouts: Array<{ layout: React.ComponentType<any>; props?: any }> = [],
): React.ReactElement {
  // Start with the page component
  let result = <ViewComponent {...props} />;

  // If no layouts passed, check if component has its own layout chain
  if (layouts.length === 0 && hasLayout(ViewComponent)) {
    let currentComponent: any = ViewComponent;
    while (hasLayout(currentComponent)) {
      layouts.push({
        layout: currentComponent.layout,
        props: currentComponent.layoutProps || {},
      });
      currentComponent = currentComponent.layout;
    }
  }

  // Wrap with each layout in REVERSE order (innermost to outermost)
  // This produces the correct nesting: RootLayout > ControllerLayout > Page
  // Must match server-side wrapping with data-layout and data-outlet attributes
  for (let i = layouts.length - 1; i >= 0; i--) {
    const { layout: Layout, props: layoutProps } = layouts[i];
    const layoutName = Layout.displayName || Layout.name || 'Layout';
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

// Build layouts array from server-provided __LAYOUTS__ data
// This ensures controller-level layouts (e.g., @Layout(RecipesLayout)) are
// included during hydration on hard refresh, not just the auto-discovered root layout
const layoutsData = window.__LAYOUTS__ || [];
const layouts: Array<{ layout: React.ComponentType<any>; props?: any }> = [];

for (const { name: layoutName, props: layoutProps } of layoutsData) {
  const layoutEntry = componentMap.find(
    (c) =>
      c.name === layoutName ||
      c.normalizedFilename === layoutName ||
      c.filename === layoutName.toLowerCase(),
  );
  if (layoutEntry) {
    layouts.push({ layout: layoutEntry.component, props: layoutProps || {} });
  } else if (layoutName === 'RootLayout' && RootLayout) {
    // Fallback: if the auto-discovered root layout wasn't in componentMap by name
    layouts.push({ layout: RootLayout, props: layoutProps || {} });
  }
}

// Fallback: if no __LAYOUTS__ data, use auto-discovered RootLayout
if (layouts.length === 0 && RootLayout) {
  layouts.push({ layout: RootLayout, props: {} });
}

// Compose the component with its layout (if any)
const composedElement = composeWithLayout(
  ViewComponent,
  initialProps,
  renderContext,
  layouts,
);

// Wrap with providers to make context and navigation state available via hooks
const wrappedElement = (
  <NavigationProvider>
    <PageContextProvider context={renderContext}>
      {composedElement}
    </PageContextProvider>
  </NavigationProvider>
);

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>{wrappedElement}</StrictMode>,
);

// Track if initial hydration is complete to ignore false popstate events
let hydrationComplete = false;
requestAnimationFrame(() => {
  hydrationComplete = true;
});

// Handle browser back/forward navigation
window.addEventListener('popstate', async () => {
  // Ignore popstate events that fire before hydration is complete
  // (some browsers fire popstate on initial page load)
  if (!hydrationComplete) return;

  // Dynamically import navigate to avoid circular dependency with hydrate-segment
  const { navigate } = await import('@nestjs-ssr/react/client');
  // Re-navigate to the current URL (browser already updated location)
  navigate(location.href, { replace: true, scroll: false });
});
