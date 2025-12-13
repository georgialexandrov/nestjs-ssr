import { SetMetadata } from '@nestjs/common';
import type { LayoutComponent } from '../interfaces/layout.interface';

export const LAYOUT_KEY = 'layout';

/**
 * Options for the Layout decorator
 */
export interface LayoutDecoratorOptions {
  /**
   * Whether to skip the root layout for this controller
   * @default false
   */
  skipRoot?: boolean;

  /**
   * Props to pass to the layout component
   */
  props?: Record<string, any>;
}

/**
 * Controller-level decorator to apply a layout to all routes in the controller.
 *
 * The layout hierarchy is: Root Layout → Controller Layout → Method Layout → Page
 *
 * @param layout - The layout component to wrap all routes in this controller
 * @param options - Optional configuration for the layout
 *
 * @example
 * ```typescript
 * // Simple usage
 * @Controller('dashboard')
 * @Layout(DashboardLayout)
 * export class DashboardController {
 *   @Get()
 *   @Render(DashboardPage) // Renders: Root > DashboardLayout > Page
 *   getDashboard() {
 *     return { stats: {...} };
 *   }
 * }
 *
 * // With options
 * @Controller('admin')
 * @Layout(AdminLayout, { skipRoot: false, props: { theme: 'dark' } })
 * export class AdminController { }
 * ```
 */
export function Layout(
  layout: LayoutComponent<any>,
  options?: LayoutDecoratorOptions,
): ClassDecorator {
  return (target: any) => {
    SetMetadata(LAYOUT_KEY, { layout, options })(target);
  };
}
