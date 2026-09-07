import { SetMetadata } from '@nestjs/common';
import type React from 'react';
import type { PageProps } from '../interfaces/page-props.interface';
import type { LayoutComponent } from '../interfaces/layout.interface';
import type { RenderResponse } from '../interfaces/render-response.interface';
import type { RepresentationPolicy } from '../interfaces/representation-policy.interface';
import type {
  ApiRepresentation,
  PageRepresentation,
  RepresentationResult,
} from '../interfaces/representation.interface';

export const RENDER_KEY = 'render';
export const RENDER_OPTIONS_KEY = 'render_options';

/**
 * Extract the data type T from PageProps<T>.
 * PageProps<T> = T & { head?, context }, so we extract T by removing those keys.
 */
type ExtractPagePropsData<P> =
  P extends PageProps<infer T>
    ? T
    : P extends { head?: any; context: any }
      ? Omit<P, 'head' | 'context'>
      : P;

/**
 * Extract controller return type from a React component's props.
 */
type ExtractComponentData<T> =
  T extends React.ComponentType<infer P> ? ExtractPagePropsData<P> : never;

/**
 * Valid return types for a @Render decorated controller method.
 *
 * Plain props and `RenderResponse` stay supported; the representation
 * factories let one action offer independently typed HTML and JSON values.
 * `json` is deliberately unconstrained by the component's props — an API DTO
 * is not a view model.
 */
type RenderReturnType<T> =
  | T
  | RenderResponse<T>
  | PageRepresentation<T>
  | ApiRepresentation<any>
  | RepresentationResult<T, any>;

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

  /**
   * Representation policy for this route: which representations it offers,
   * its payload limits, render deadline, cache stance, and security headers.
   *
   * Overrides the module policy field by field. Limits may only be tightened,
   * and a policy the module declared `mandatory` may not be overridden at all.
   *
   * @example
   * ```typescript
   * @Render(OrderPage, {
   *   representation: {
   *     json: true,
   *     cache: { visibility: 'public', maxAge: 60, keys: ['Accept-Language'] },
   *   },
   * })
   * ```
   */
  representation?: RepresentationPolicy;

  /**
   * Enable or disable JSON API mode for this route.
   *
   * @deprecated Use `representation: { json: true | false }`. This alias still
   * works during the compatibility release and is ignored when
   * `representation.json` is set.
   *
   * - `true`: This route serves JSON when `Accept: application/json` is sent
   * - `false`: This route returns 406 for JSON requests
   * - `undefined`: Uses the module-level setting (default `false`)
   */
  jsonApi?: boolean;
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
): <
  TMethod extends (
    ...args: any[]
  ) =>
    | RenderReturnType<ExtractComponentData<T>>
    | Promise<RenderReturnType<ExtractComponentData<T>>>,
>(
  target: object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<TMethod>,
) => TypedPropertyDescriptor<TMethod> | void {
  return <TMethod>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<TMethod>,
  ) => {
    SetMetadata(RENDER_KEY, component)(target, propertyKey, descriptor);
    if (options) {
      SetMetadata(RENDER_OPTIONS_KEY, options)(target, propertyKey, descriptor);
    }
  };
}
