import { SetMetadata } from '@nestjs/common';
import type React from 'react';
import type { PageProps } from '../interfaces/page-props.interface';

export const RENDER_KEY = 'render';

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
 * Decorator to render a React component as the response.
 *
 * Import the component directly for Cmd+Click navigation in your IDE.
 * TypeScript automatically validates your controller returns the correct props.
 *
 * @param component - The React component to render
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
 * ```
 */
export function Render<T extends React.ComponentType<any>>(
  component: T,
): <TMethod extends (...args: any[]) => ExtractComponentData<T> | Promise<ExtractComponentData<T>>>(
  target: any,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<TMethod>,
) => TypedPropertyDescriptor<TMethod> | void {
  return (target: any, propertyKey: string | symbol, descriptor: any) => {
    SetMetadata(RENDER_KEY, component)(target, propertyKey, descriptor);
  };
}

/**
 * @deprecated Use `Render` instead. This alias will be removed in a future version.
 */
export const ReactRender = Render;
