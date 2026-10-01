import type { ComponentType, ReactNode } from 'react';
import type { RenderContext } from './render-context.interface';
import type { HeadData } from './render-response.interface';

/**
 * Props passed to layout components
 *
 * Layout components receive children and can access context/head data.
 * Additional props can be specified via layoutProps static property.
 *
 * @example
 * ```tsx
 * export default function MainLayout({ children, title }: LayoutProps<{ title: string }>) {
 *   return (
 *     <html>
 *       <head>
 *         <title>{title || 'Default Title'}</title>
 *       </head>
 *       <body>
 *         <nav>...</nav>
 *         <main>{children}</main>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export interface LayoutProps<TProps = object> {
  /**
   * Child content to render (the page component or nested layout)
   */
  children: ReactNode;

  /**
   * Layout-specific props passed via component.layoutProps
   */
  layoutProps?: TProps;

  /**
   * Request context available to all layouts
   */
  context?: RenderContext;

  /**
   * Head metadata that can be read by layouts
   */
  head?: HeadData;
}

/**
 * Layout component type
 *
 * A layout is a React component that wraps page content.
 * Page components can declare their layout using static properties.
 *
 * @example
 * ```tsx
 * // Layout definition
 * const MainLayout: LayoutComponent<{ title: string }> = ({ children, title }) => (
 *   <html>
 *     <body>
 *       <h1>{title}</h1>
 *       {children}
 *     </body>
 *   </html>
 * );
 *
 * // Page using the layout
 * function HomePage() {
 *   return <div>Welcome</div>;
 * }
 * HomePage.layout = MainLayout;
 * HomePage.layoutProps = { title: 'Home' };
 * ```
 */
export type LayoutComponent<TProps = object> = ComponentType<
  LayoutProps<TProps>
>;

/**
 * Enhanced page component with layout support
 *
 * Page components can optionally specify a layout via static properties.
 * The framework will automatically wrap the page in the specified layout.
 *
 * @deprecated The static `layout` / `layoutProps` properties this describes
 * are read only by the client entry template's fallback chain-walk, not by
 * the server, which resolves its layout chain from decorator metadata —
 * using only this form causes a server/client hydration mismatch. Prefer
 * `@Layout()` / `@Render(_, { layout })` decorator metadata.
 */
export interface PageComponentWithLayout<
  TPageProps = object,
  TLayoutProps = object,
> {
  /**
   * The page component function
   */
  (props: TPageProps): ReactNode;

  /**
   * Optional layout component to wrap this page
   * If not specified, the page renders without a layout wrapper.
   *
   * @deprecated Only the client entry template's fallback chain-walk reads
   * this — the server builds its layout chain from decorator metadata
   * instead, so a component using only this static-property form renders
   * with the root layout only on the server and then hydrates with the
   * client's fuller chain, a hydration mismatch. Prefer `@Layout()` /
   * `@Render(_, { layout })` decorator metadata.
   */
  layout?: LayoutComponent<TLayoutProps>;

  /**
   * Optional props to pass to the layout component
   * These props are available as layoutProps in the LayoutProps.
   *
   * @deprecated Same hydration-mismatch hazard as `layout` above — read only
   * by the client fallback chain-walk, not the server. Prefer decorator
   * metadata (`@Layout()` / `@Render(_, { layout })`).
   */
  layoutProps?: TLayoutProps;
}
