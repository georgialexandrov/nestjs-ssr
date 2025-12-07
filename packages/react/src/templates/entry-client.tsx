import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { viewRegistry } from '@/views/view-registry.generated';

const viewPath = window.__COMPONENT_PATH__;
const initialProps = window.__INITIAL_STATE__ || {};
const renderContext = window.__CONTEXT__ || {};

const ViewComponent = viewRegistry[viewPath];

if (!ViewComponent) {
  throw new Error(`View "${viewPath}" not found in registry`);
}

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <ViewComponent {...initialProps} context={renderContext} />
  </StrictMode>,
);
