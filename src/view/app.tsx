import React from 'react';
import { PageContextProvider } from './hooks/use-page-context';
import { ErrorBoundary } from '../shared/views/error-boundary';
import type { RenderContext } from '../shared/render/interfaces/index';

interface AppProps {
  children: React.ReactNode;
  context: RenderContext;
}

export default function App({ children, context }: AppProps) {
  return (
    <PageContextProvider context={context}>
      <ErrorBoundary>
        <div id="app">
          {children}
        </div>
      </ErrorBoundary>
    </PageContextProvider>
  );
}
