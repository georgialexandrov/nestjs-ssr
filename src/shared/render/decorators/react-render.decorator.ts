import { SetMetadata } from '@nestjs/common';

export const REACT_RENDER_KEY = 'reactRender';

/**
 * Decorator to render a React component as the response
 * @param viewPath - Path to the React component (e.g., 'users/views/user-list')
 */
export const ReactRender = (viewPath: string) =>
  SetMetadata(REACT_RENDER_KEY, viewPath);
