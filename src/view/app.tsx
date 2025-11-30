import React from 'react';
import { PageContextProvider } from './hooks/use-page-context.js';
import type { RenderContext } from '../shared/render/interfaces/index.js';

interface AppProps {
  children: React.ReactNode;
  context: RenderContext;
}

export default function App({ children, context }: AppProps) {
  return (
    <PageContextProvider context={context}>
      <div id="app">
        {children}
      </div>
    </PageContextProvider>
  );
}
