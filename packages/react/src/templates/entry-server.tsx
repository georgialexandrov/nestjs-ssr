import React from 'react';
import { renderToString, renderToPipeableStream } from 'react-dom/server';
import { PageContextProvider } from '@nestjs-ssr/react/client';

/**
 * Compose a component with its layouts from the interceptor.
 * Layouts are passed from the RenderInterceptor based on decorators.
 * Each layout is wrapped with data-layout and data-outlet attributes
 * for client-side navigation segment swapping.
 */
function composeWithLayouts(
  ViewComponent: React.ComponentType<any>,
  props: any,
  layouts: Array<{ layout: React.ComponentType<any>; props?: any }> = [],
  context?: any,
): React.ReactElement {
  // Start with the page component
  let result = <ViewComponent {...props} />;

  // Wrap with each layout in the chain (outermost to innermost in array)
  // We iterate normally because layouts are already in correct order from interceptor
  // Pass context to layouts so they can access path, params, etc. for navigation
  // Each layout gets data-layout attribute and children are wrapped in data-outlet
  for (const { layout: Layout, props: layoutProps } of layouts) {
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

/**
 * String-based SSR (mode: 'string')
 * Simple, synchronous rendering
 */
export function renderComponent(
  ViewComponent: React.ComponentType<any>,
  data: any,
) {
  const { data: pageData, __context: context, __layouts: layouts } = data;
  const composedElement = composeWithLayouts(
    ViewComponent,
    pageData,
    layouts,
    context,
  );

  // Wrap with PageContextProvider to make context available via hooks
  const wrappedElement = (
    <PageContextProvider context={context}>
      {composedElement}
    </PageContextProvider>
  );

  return renderToString(wrappedElement);
}

/**
 * Render just the page component for segment navigation.
 * No layout wrappers - the layout already exists on the client.
 */
export function renderSegment(
  ViewComponent: React.ComponentType<any>,
  data: any,
) {
  const { data: pageData, __context: context } = data;

  // Render just the page component, no layout wrappers
  const element = (
    <PageContextProvider context={context}>
      <ViewComponent {...pageData} />
    </PageContextProvider>
  );

  return renderToString(element);
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
  const composedElement = composeWithLayouts(
    ViewComponent,
    pageData,
    layouts,
    context,
  );

  // Wrap with PageContextProvider to make context available via hooks
  const wrappedElement = (
    <PageContextProvider context={context}>
      {composedElement}
    </PageContextProvider>
  );

  return renderToPipeableStream(wrappedElement, callbacks);
}
