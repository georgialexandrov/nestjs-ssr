import { SetMetadata } from '@nestjs/common';

export const RENDER_KEY = 'render';

/**
 * Interface for view paths - augmented by the generated view registry.
 * This enables type-safe path validation in Render decorator.
 */
export interface ViewPaths {}

/**
 * Interface for view props mapping - augmented by the generated view registry.
 * This maps view paths to their expected prop types.
 */
export interface ViewPropsMap {}

/**
 * Type-safe view path - union of all registered view paths.
 * This is populated via module augmentation from the generated view registry.
 */
export type ViewPath = keyof ViewPaths extends never ? string : keyof ViewPaths;

/**
 * Helper type to extract the props type for a given view path.
 * This is automatically enforced by the Render decorator.
 */
export type RenderProps<T extends ViewPath> = T extends keyof ViewPropsMap
  ? ViewPropsMap[T]
  : Record<string, any>;

/**
 * Decorator to render a React component as the response.
 * Provides IDE autocomplete and type checking for view paths AND props.
 *
 * Works the same as NestJS's @Render() decorator for template engines,
 * but renders React components with SSR instead.
 *
 * The decorator automatically validates that your controller method returns
 * the correct props type for the specified view component - no manual type
 * annotations needed!
 *
 * @param viewPath - Path to the React component (e.g., 'users/views/user-list')
 *
 * @example
 * ```typescript
 * // Your view component (users/views/user-list.tsx)
 * export interface ViewsUserListProps {
 *   users: User[];
 * }
 * export default function UserList(props: PageProps<ViewsUserListProps>) { ... }
 *
 * // Your controller - TypeScript automatically validates the return type!
 * @Get()
 * @Render('users/views/user-list')
 * getUsers() {
 *   return { users: [...] }; // Type-safe! No manual annotation needed.
 * }
 * ```
 */
export function Render<T extends ViewPath>(
  viewPath: T,
): <TMethod extends (...args: any[]) => RenderProps<T> | Promise<RenderProps<T>>>(
  target: any,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<TMethod>,
) => TypedPropertyDescriptor<TMethod> | void {
  return (target: any, propertyKey: string | symbol, descriptor: any) => {
    SetMetadata(RENDER_KEY, viewPath)(target, propertyKey, descriptor);
  };
}

/**
 * @deprecated Use `Render` instead. This alias will be removed in a future version.
 */
export const ReactRender = Render;
