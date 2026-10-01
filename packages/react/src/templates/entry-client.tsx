/// <reference types="@nestjs-ssr/react/global" />

import React, { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import {
  PageContextProvider,
  NavigationProvider,
  buildComponentRegistry,
  resolveViewComponent,
  loadViewModules,
  composeWithLayouts,
  type ViewModuleLoaders,
} from '@nestjs-ssr/react/client';

const componentName = window.__COMPONENT_NAME__;
const initialProps = window.__INITIAL_STATE__ || {};
const renderContext = window.__CONTEXT__ || {};

// Auto-discover root layout using Vite's glob import (must match server-side discovery)
// @ts-ignore - Vite-specific API
const layoutModules = import.meta.glob('@/views/layout.tsx', {
  eager: true,
}) as Record<string, { default: React.ComponentType<any> }>;

const layoutPath = Object.keys(layoutModules)[0];
const RootLayout = layoutPath ? layoutModules[layoutPath].default : null;

// Discover every view component with Vite's glob feature, but load them
// lazily: each view becomes its own chunk, so a page downloads only its own
// view (and layouts), not every page in the app. Match any `views` directory
// under the source root (`@`), so views colocated inside feature modules
// (e.g. `@/products/views/list.tsx`) are discovered too. Exclude entry-* files.
// The server preloads the current page's chunk, so waiting for it here does
// not add a round trip.
// @ts-ignore - Vite-specific API
const viewLoaders: ViewModuleLoaders = import.meta.glob([
  '@/**/views/**/*.tsx',
  '!@/**/views/entry-*.tsx',
]);

// Client-side navigation loads further views through these loaders.
window.__VIEW_LOADERS__ = viewLoaders;

const layoutsData = window.__LAYOUTS__ || [];
const modules = await loadViewModules(
  viewLoaders,
  [componentName, ...layoutsData.map((layout) => layout.name)],
  {
    // The root layout is already imported above; reuse it rather than fetch it.
    preloaded: layoutModules,
    // Views by component name, from the nestjsSsr() Vite plugin, so a view is
    // found whatever its file is called. Absent without the plugin.
    index:
      typeof __NESTJS_SSR_VIEWS__ !== 'undefined'
        ? __NESTJS_SSR_VIEWS__
        : undefined,
  },
);

// Export modules globally for segment hydration after client-side navigation
window.__MODULES__ = modules;

// Build the component registry once (used below for layout lookups).
const componentMap = buildComponentRegistry(modules);

// Resolve the page component the server rendered. The shared resolver matches by
// displayName/name, then normalized (PascalCase) filename, then minified default
// exports — and logs a clear error if the name collides across views directories.
const ViewComponent = resolveViewComponent(componentName, modules);

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
 *
 * When the server sent no `__LAYOUTS__` (e.g. a static export, or a page with
 * no controller-level layout), fall back to the page's static `.layout` /
 * `.layoutProps` chain — discovered here, not in the shared composer, since
 * it only applies to this initial-hydration entry point. Either way, the
 * actual wrap/nest is delegated to `composeWithLayouts`, the single
 * implementation shared with entry-server.tsx and hydrate-segment.tsx.
 */
function composeWithLayout(
  ViewComponent: React.ComponentType<any>,
  props: any,
  context?: any,
  layouts: Array<{
    layout: React.ComponentType<any>;
    props?: any;
    name?: string;
  }> = [],
): React.ReactElement {
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

  return composeWithLayouts(ViewComponent, props, layouts, context);
}

// Build layouts array from server-provided __LAYOUTS__ data
// This ensures controller-level layouts (e.g., @Layout(RecipesLayout)) are
// included during hydration on hard refresh, not just the auto-discovered root layout
const layouts: Array<{
  layout: React.ComponentType<any>;
  props?: any;
  name?: string;
}> = [];

for (const { name: layoutName, props: layoutProps } of layoutsData) {
  const layoutEntry = componentMap.find(
    (c) =>
      c.name === layoutName ||
      c.normalizedFilename === layoutName ||
      c.filename === layoutName.toLowerCase(),
  );
  if (layoutEntry) {
    // Keep the exact name the server already committed to the SSR HTML
    // (`data-layout`/`data-outlet`), rather than re-deriving it from this
    // component's `displayName`/`.name` — a production build minifies the
    // client bundle, so the two can disagree, and disagreeing here is a
    // hydration mismatch. `hydrate-segment.tsx` does the same for the same
    // reason.
    layouts.push({
      layout: layoutEntry.component,
      props: layoutProps || {},
      name: layoutName,
    });
  } else if (layoutName === 'RootLayout' && RootLayout) {
    // Fallback: if the auto-discovered root layout wasn't in componentMap by name
    layouts.push({
      layout: RootLayout,
      props: layoutProps || {},
      name: layoutName,
    });
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

// Marks when hydration starts, for performance measurement (DevTools, the
// Performance API).
performance.mark('nestjs-ssr:hydrate');
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
