import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';

const componentName = window.__COMPONENT_NAME__;
const initialProps = window.__INITIAL_STATE__ || {};
const renderContext = window.__CONTEXT__ || {};

// Auto-import all view components using Vite's glob feature
// @ts-ignore - Vite-specific API
const modules: Record<string, { default: React.ComponentType<any> }> = import.meta.glob('@/views/**/*.tsx', { eager: true });

// Build a map of components with their metadata
const componentMap = Object.entries(modules).map(([path, module]) => {
  const component = module.default;
  const name = component.displayName || component.name;
  const filename = path.split('/').pop()?.replace('.tsx', '');
  const normalizedFilename = filename ? filename.charAt(0).toUpperCase() + filename.slice(1) : undefined;

  return { path, component, name, filename, normalizedFilename };
});

// Find the component by matching in this order:
// 1. Exact match by displayName or function name
// 2. Match by normalized filename (e.g., "home.tsx" -> "Home")
// 3. If only one component exists, use it (regardless of name)
let ViewComponent: React.ComponentType<any> | undefined;

// Try exact name match first
ViewComponent = componentMap.find(
  (c) => c.name === componentName || c.normalizedFilename === componentName || c.filename === componentName.toLowerCase()
)?.component;

// If no match found and component name looks like a generic/minified name (default, default_1, etc.)
// and there's only one component, use it
if (!ViewComponent && /^default(_\d+)?$/.test(componentName) && componentMap.length === 1) {
  ViewComponent = componentMap[0].component;
}

if (!ViewComponent) {
  const availableComponents = Object.entries(modules).map(([path, m]) => {
    const filename = path.split('/').pop()?.replace('.tsx', '');
    const name = m.default.displayName || m.default.name;
    return `${filename} (${name})`;
  }).join(', ');
  throw new Error(`Component "${componentName}" not found in views directory. Available: ${availableComponents}`);
}

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <ViewComponent {...initialProps} context={renderContext} />
  </StrictMode>,
);
