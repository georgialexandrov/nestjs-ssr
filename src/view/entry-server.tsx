import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './app';
import { viewRegistry } from './view-registry.generated';

export async function renderComponent(
  componentPath: string,
  props: any = {},
): Promise<string> {
  try {
    const Component = viewRegistry[componentPath];

    if (!Component) {
      throw new Error(
        `Component not found at path: ${componentPath}. Available paths: ${Object.keys(viewRegistry).join(', ')}`,
      );
    }

    // Extract data and context from props
    const { data, __context: context } = props;

    // Render the component wrapped in App with context
    const html = renderToString(
      <App context={context}>
        <Component data={data} context={context} />
      </App>,
    );

    return html;
  } catch (error) {
    console.error(`Failed to render component at ${componentPath}:`, error);
    throw error;
  }
}
