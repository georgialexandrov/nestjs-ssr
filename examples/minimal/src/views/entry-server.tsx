import React from 'react';
import { renderToString, renderToPipeableStream } from 'react-dom/server';
import { PageContextProvider } from '@nestjs-ssr/react';

/**
 * Compose a component with its layouts from the interceptor
 * Layouts are passed from the RenderInterceptor based on decorators
 */
function composeWithLayouts(
  ViewComponent: React.ComponentType<any>,
  props: any,
  layouts: Array<{ layout: React.ComponentType<any>; props?: any }> = [],
): React.ReactElement {
  // Start with the page component
  let result = <ViewComponent {...props} />;

  // Wrap with each layout in the chain (outermost to innermost in array)
  // We iterate normally because layouts are already in correct order from interceptor
  for (const { layout: Layout, props: layoutProps } of layouts) {
    result = <Layout layoutProps={layoutProps}>{result}</Layout>;
  }

  return result;
}

/**
 * String-based SSR (mode: 'string')
 * Simple, synchronous rendering
 */
export function renderComponent(
  ViewComponent: React.ComponentType<any>,
  data: any,
) {
  const { data: pageData, __context: context, __layouts: layouts } = data;
  const composedElement = composeWithLayouts(ViewComponent, pageData, layouts);

  // Wrap with PageContextProvider to make context available via hooks
  const wrappedElement = (
    <PageContextProvider context={context}>
      {composedElement}
    </PageContextProvider>
  );

  return renderToString(wrappedElement);
}

/**
 * Streaming SSR (mode: 'stream' - default)
 * Modern approach with progressive rendering and Suspense support
 */
export function renderComponentStream(
  ViewComponent: React.ComponentType<any>,
  data: any,
  callbacks?: {
    onShellReady?: () => void;
    onShellError?: (error: unknown) => void;
    onError?: (error: unknown) => void;
    onAllReady?: () => void;
  },
) {
  const { data: pageData, __context: context, __layouts: layouts } = data;
  const composedElement = composeWithLayouts(ViewComponent, pageData, layouts);

  // Wrap with PageContextProvider to make context available via hooks
  const wrappedElement = (
    <PageContextProvider context={context}>
      {composedElement}
    </PageContextProvider>
  );

  return renderToPipeableStream(wrappedElement, callbacks);
}
