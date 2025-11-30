import { SetMetadata } from '@nestjs/common';

export const REACT_RENDER_KEY = 'reactRender';

/**
 * Interface for view paths - augmented by the generated view registry.
 * This enables type-safe path validation in ReactRender decorator.
 */
export interface ViewPaths {}

/**
 * Type-safe view path - union of all registered view paths.
 * This is populated via module augmentation from the generated view registry.
 */
export type ViewPath = keyof ViewPaths extends never ? string : keyof ViewPaths;

/**
 * Decorator to render a React component as the response.
 * Provides IDE autocomplete and type checking for view paths.
 *
 * @param viewPath - Path to the React component (e.g., 'users/views/user-list')
 *
 * @example
 * ```typescript
 * @Get()
 * @ReactRender('users/views/user-list')
 * getUsers() {
 *   return { users: [...] };
 * }
 * ```
 */
export const ReactRender = (viewPath: ViewPath) =>
  SetMetadata(REACT_RENDER_KEY, viewPath);
