import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';

const componentName = window.__COMPONENT_NAME__;
const initialProps = window.__INITIAL_STATE__ || {};
const renderContext = window.__CONTEXT__ || {};

// Auto-import all view components using Vite's glob feature
// @ts-ignore - Vite-specific API
const modules: Record<string, { default: React.ComponentType<any> }> = import.meta.glob('@/views/**/*.tsx', { eager: true });

// Find the component by matching its display name or function name
let ViewComponent: React.ComponentType<any> | undefined;
for (const module of Object.values(modules)) {
  const component = module.default;
  const name = component.displayName || component.name;
  if (name === componentName) {
    ViewComponent = component;
    break;
  }
}

if (!ViewComponent) {
  throw new Error(`Component "${componentName}" not found in views directory. Available components: ${Object.values(modules).map(m => m.default.displayName || m.default.name).join(', ')}`);
}

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <ViewComponent {...initialProps} context={renderContext} />
  </StrictMode>,
);
