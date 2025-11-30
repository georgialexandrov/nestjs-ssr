import React from 'react';
import { PageContextProvider } from './hooks/use-page-context';
import { ErrorBoundary } from './error-boundary';
import type { RenderContext } from '../interfaces/index';

interface AppWrapperProps {
  viewRegistry: Record<string, React.ComponentType<any>>;
  viewPath?: string;
  initialProps?: any;
  initialContext?: RenderContext;
}

export default function AppWrapper({
  viewRegistry,
  viewPath,
  initialProps,
  initialContext
}: AppWrapperProps) {
  // If viewPath is provided, render that specific view (SSR mode)
  if (viewPath && initialProps && initialContext) {
    const ViewComponent = viewRegistry[viewPath];
    if (!ViewComponent) {
      throw new Error(`View not found: ${viewPath}`);
    }

    return (
      <PageContextProvider context={initialContext}>
        <ErrorBoundary>
          <ViewComponent data={initialProps} context={initialContext} />
        </ErrorBoundary>
      </PageContextProvider>
    );
  }

  // Client-side hydration mode - render from global state
  if (typeof window !== 'undefined' && initialProps && initialContext) {
    // On the client, we need to determine which view to render from the DOM
    // This is handled by the viewPath that was serialized to the page
    const serializedViewPath = (window as any).__VIEW_PATH__;
    const ViewComponent = viewRegistry[serializedViewPath];

    if (!ViewComponent) {
      throw new Error(`View not found during hydration: ${serializedViewPath}`);
    }

    return (
      <PageContextProvider context={initialContext}>
        <ErrorBoundary>
          <ViewComponent data={initialProps} context={initialContext} />
        </ErrorBoundary>
      </PageContextProvider>
    );
  }

  return null;
}
