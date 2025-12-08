import { renderToString } from 'react-dom/server';

export function renderComponent(
  ViewComponent: React.ComponentType<any>,
  data: any,
) {
  const { data: pageData, __context: context } = data;
  return renderToString(<ViewComponent {...pageData} context={context} />);
}
