import React from 'react';
import { renderToString, renderToPipeableStream } from 'react-dom/server';
import { PageContextProvider } from '@nestjs-ssr/react/client';

// Auto-discover root layout using Vite's glob import
// This eagerly loads layout if it exists, null otherwise
// @ts-ignore - Vite-specific API
const layoutModules = import.meta.glob('@/views/layout.tsx', {
  eager: true,
}) as Record<string, { default: React.ComponentType<any> }>;

const layoutPath = Object.keys(layoutModules)[0];
const RootLayout = layoutPath ? layoutModules[layoutPath].default : null;

/**
 * Get the root layout component.
 * Used by RenderService in production when dynamic import isn't available.
 */
export function getRootLayout(): React.ComponentType<any> | null {
  return RootLayout;
}

/**
 * Compose a component with its layouts from the interceptor.
 * Layouts are passed from the RenderInterceptor based on decorators.
 * Each layout is wrapped with data-layout and data-outlet attributes
 * for client-side navigation segment swapping.
 *
 * The layouts array is ordered [RootLayout, ControllerLayout, MethodLayout] (outer to inner).
 * We iterate in REVERSE order because wrapping happens inside-out:
 * - Start with Page
 * - Wrap with innermost layout first (MethodLayout)
 * - Then wrap with ControllerLayout
 * - Finally wrap with RootLayout (outermost)
 */
function composeWithLayouts(
  ViewComponent: React.ComponentType<any>,
  props: any,
  layouts: Array<{ layout: React.ComponentType<any>; props?: any }> = [],
  context?: any,
): React.ReactElement {
  // Start with the page component
  let result = <ViewComponent {...props} />;

  // Wrap with each layout in REVERSE order (innermost to outermost)
  // This produces the correct nesting: RootLayout > ControllerLayout > Page
  // Pass context to layouts so they can access path, params, etc. for navigation
  // Each layout gets data-layout attribute and children are wrapped in data-outlet
  for (let i = layouts.length - 1; i >= 0; i--) {
    const { layout: Layout, props: layoutProps } = layouts[i];
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
 * Render a segment for client-side navigation.
 * Includes any layouts below the swap target (e.g., nested layouts).
 * The swap target's outlet will receive this rendered content.
 */
export function renderSegment(
  ViewComponent: React.ComponentType<any>,
  data: any,
) {
  const { data: pageData, __context: context, __layouts: layouts } = data;

  // Compose with filtered layouts (layouts below the swap target)
  const composedElement = composeWithLayouts(
    ViewComponent,
    pageData,
    layouts,
    context,
  );

  // Wrap with PageContextProvider to make context available via hooks
  const element = (
    <PageContextProvider context={context}>
      {composedElement}
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
