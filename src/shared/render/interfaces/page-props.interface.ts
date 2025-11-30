import type { RenderContext } from './render-context.interface.js';

/**
 * Generic interface for React page component props.
 * Combines controller data with request context.
 *
 * @template TData - The shape of data returned by the controller
 *
 * @example
 * ```typescript
 * interface UserListData {
 *   users: User[];
 * }
 *
 * export default function UserList({ data, context }: PageProps<UserListData>) {
 *   const { users } = data;
 *   const { query } = context;
 *   // ...
 * }
 * ```
 */
export interface PageProps<TData = unknown> {
  /**
   * Data returned from the NestJS controller.
   * Type-safe based on controller return type.
   */
  data: TData;

  /**
   * Request context containing URL metadata and safe headers.
   */
  context: RenderContext;
}
