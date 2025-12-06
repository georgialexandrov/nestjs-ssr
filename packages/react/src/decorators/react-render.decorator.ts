import { SetMetadata } from '@nestjs/common';

export const RENDER_KEY = 'render';

/**
 * Interface for view paths - augmented by the generated view registry.
 * This enables type-safe path validation in Render decorator.
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
 * Works the same as NestJS's @Render() decorator for template engines,
 * but renders React components with SSR instead.
 *
 * @param viewPath - Path to the React component (e.g., 'users/views/user-list')
 *
 * @example
 * ```typescript
 * @Get()
 * @Render('users/views/user-list')
 * getUsers() {
 *   return { users: [...] };
 * }
 * ```
 */
export const Render = (viewPath: ViewPath) =>
  SetMetadata(RENDER_KEY, viewPath);

/**
 * @deprecated Use `Render` instead. This alias will be removed in a future version.
 */
export const ReactRender = Render;
