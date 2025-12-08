import { SetMetadata } from '@nestjs/common';
import type React from 'react';
import type { PageProps } from '../interfaces/page-props.interface';
import type { LayoutComponent } from '../interfaces/layout.interface';
import type { RenderResponse } from '../interfaces/render-response.interface';

export const RENDER_KEY = 'render';
export const RENDER_OPTIONS_KEY = 'render_options';

/**
 * Extract the data type T from PageProps<T>.
 * PageProps<T> = T & { head?, context }, so we extract T by removing those keys.
 */
type ExtractPagePropsData<P> = P extends PageProps<infer T>
  ? T
  : P extends { head?: any; context: any }
    ? Omit<P, 'head' | 'context'>
    : P;

/**
 * Extract controller return type from a React component's props.
 */
type ExtractComponentData<T> = T extends React.ComponentType<infer P>
  ? ExtractPagePropsData<P>
  : never;

/**
 * Valid return types for a @Render decorated controller method.
 * Supports both simple props format and RenderResponse format with layoutProps.
 */
type RenderReturnType<T> = T | RenderResponse<T>;

/**
 * Options for the Render decorator
 */
export interface RenderOptions {
  /**
   * Layout component to wrap this specific route.
   * - LayoutComponent: Use this layout (replaces controller layout if any)
   * - false: Skip controller layout, keep root layout only
   * - null: Skip all layouts (render page only)
   * - undefined: Use controller layout (default)
   */
  layout?: LayoutComponent<any> | false | null;

  /**
   * Props to pass to the layout component
   */
  layoutProps?: Record<string, any>;
}

/**
 * Decorator to render a React component as the response.
 *
 * Import the component directly for Cmd+Click navigation in your IDE.
 * TypeScript automatically validates your controller returns the correct props.
 *
 * @param component - The React component to render
 * @param options - Optional rendering options (layout overrides, etc.)
 *
 * @example
 * ```typescript
 * // Your view component (views/home.tsx)
 * export interface HomeProps {
 *   message: string;
 * }
 * export default function Home(props: PageProps<HomeProps>) { ... }
 *
 * // Your controller - Cmd+Click on Home navigates to the view file!
 * import Home from './views/home';
 *
 * @Get()
 * @Render(Home)  // Type-safe! Wrong props = build error
 * getHome() {
 *   return { message: 'Hello' }; // ✅ Correct
 *   // return { wrong: 'prop' }; // ❌ Type error!
 * }
 *
 * // With layout override
 * @Get('custom')
 * @Render(CustomPage, { layout: CustomLayout })
 * getCustom() {
 *   return { data: 'custom' };
 * }
 *
 * // Skip all layouts
 * @Get('raw')
 * @Render(RawPage, { layout: null })
 * getRaw() {
 *   return { json: {...} };
 * }
 * ```
 */
export function Render<T extends React.ComponentType<any>>(
  component: T,
  options?: RenderOptions,
): <TMethod extends (...args: any[]) => RenderReturnType<ExtractComponentData<T>> | Promise<RenderReturnType<ExtractComponentData<T>>>>(
  target: any,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<TMethod>,
) => TypedPropertyDescriptor<TMethod> | void {
  return (target: any, propertyKey: string | symbol, descriptor: any) => {
    SetMetadata(RENDER_KEY, component)(target, propertyKey, descriptor);
    if (options) {
      SetMetadata(RENDER_OPTIONS_KEY, options)(target, propertyKey, descriptor);
    }
  };
}

/**
 * @deprecated Use `Render` instead. This alias will be removed in a future version.
 */
export const ReactRender = Render;
