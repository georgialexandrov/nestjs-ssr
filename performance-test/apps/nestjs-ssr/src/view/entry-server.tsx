import { renderToString } from 'react-dom/server';
import { viewRegistry } from './view-registry.generated';

export function renderComponent(viewPath: string, data: any) {
  const ViewComponent = viewRegistry[viewPath];

  if (!ViewComponent) {
    throw new Error(`View "${viewPath}" not found in registry`);
  }

  const { data: pageData, __context: context } = data;
  return renderToString(<ViewComponent data={pageData} context={context} />);
}
