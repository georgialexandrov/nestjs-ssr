/// <reference types="@nestjs-ssr/react/global" />
import React, { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';

const componentName = window.__COMPONENT_NAME__;
const initialProps = window.__INITIAL_STATE__ || {};
const renderContext = window.__CONTEXT__ || {};

// Auto-import all view components using Vite's glob feature
const modules: Record<string, { default: React.ComponentType<any> }> = import.meta.glob('@/views/**/*.tsx', { eager: true });

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
    const normalizedFilename = filename ? filename.charAt(0).toUpperCase() + filename.slice(1) : undefined;

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
  (c) => c.name === componentName || c.normalizedFilename === componentName || c.filename === componentName.toLowerCase()
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
      .filter(c => c.name === 'default')
      .sort((a, b) => a.path.localeCompare(b.path));

    // Try to match by index
    if (defaultComponents[index]) {
      ViewComponent = defaultComponents[index].component;
    }
  }
}

if (!ViewComponent) {
  const availableComponents = Object.entries(modules).map(([path, m]) => {
    const filename = path.split('/').pop()?.replace('.tsx', '');
    const name = m.default.displayName || m.default.name;
    return `${filename} (${name})`;
  }).join(', ');
  throw new Error(`Component "${componentName}" not found in views directory. Available: ${availableComponents}`);
}

/**
 * Compose a component with its layouts from the interceptor
 * Layouts are passed from the server in window.__LAYOUTS__
 */
function composeWithLayouts(
  ViewComponent: React.ComponentType<any>,
  props: any,
  context: any,
  layouts: Array<{ layout: React.ComponentType<any>; props?: any }> = [],
): React.ReactElement {
  // Start with the page component
  let result = <ViewComponent {...props} context={context} />;

  // Wrap with each layout in the chain
  for (const { layout: Layout, props: layoutProps } of layouts) {
    result = (
      <Layout layoutProps={layoutProps} context={context}>
        {result}
      </Layout>
    );
  }

  return result;
}

// Get layout metadata from server (passed via __LAYOUTS__ window variable)
const layoutMetadata: Array<{ name: string; props?: any }> = (window as any).__LAYOUTS__ || [];

// Look up layout components by name and build layout chain
const layouts = layoutMetadata.map((meta) => {
  // Find layout component by matching name
  const layoutEntry = componentMap.find(
    (c) => c.name === meta.name || c.normalizedFilename === meta.name || c.filename === meta.name.toLowerCase()
  );

  if (!layoutEntry) {
    console.warn(`Layout component "${meta.name}" not found. Skipping.`);
    return null;
  }

  return { layout: layoutEntry.component, props: meta.props };
}).filter(Boolean) as Array<{ layout: React.ComponentType<any>; props?: any }>;

// Compose the component with its layouts
const composedElement = composeWithLayouts(ViewComponent, initialProps, renderContext, layouts);

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    {composedElement}
  </StrictMode>,
);
