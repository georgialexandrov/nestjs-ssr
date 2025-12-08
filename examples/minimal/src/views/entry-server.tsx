import React from 'react';
import { renderToString } from 'react-dom/server';

/**
 * Compose a component with its layouts from the interceptor
 * Layouts are passed from the RenderInterceptor based on decorators
 */
function composeWithLayouts(
  ViewComponent: React.ComponentType<any>,
  props: any,
  context: any,
  layouts: Array<{ layout: React.ComponentType<any>; props?: any }> = [],
): React.ReactElement {
  // Start with the page component
  let result = <ViewComponent {...props} context={context} />;

  // Wrap with each layout in the chain (outermost to innermost in array)
  // We iterate normally because layouts are already in correct order from interceptor
  for (const { layout: Layout, props: layoutProps } of layouts) {
    result = (
      <Layout layoutProps={layoutProps} context={context}>
        {result}
      </Layout>
    );
  }

  return result;
}

export function renderComponent(
  ViewComponent: React.ComponentType<any>,
  data: any,
) {
  const { data: pageData, __context: context, __layouts: layouts } = data;
  const composedElement = composeWithLayouts(ViewComponent, pageData, context, layouts);
  return renderToString(composedElement);
}
