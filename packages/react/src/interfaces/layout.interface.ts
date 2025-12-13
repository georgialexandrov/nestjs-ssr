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
export interface LayoutProps<TProps = {}> {
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
export type LayoutComponent<TProps = {}> = ComponentType<LayoutProps<TProps>>;

/**
 * Enhanced page component with layout support
 *
 * Page components can optionally specify a layout via static properties.
 * The framework will automatically wrap the page in the specified layout.
 */
export interface PageComponentWithLayout<TPageProps = {}, TLayoutProps = {}> {
  /**
   * The page component function
   */
  (props: TPageProps): ReactNode;

  /**
   * Optional layout component to wrap this page
   * If not specified, the page renders without a layout wrapper.
   */
  layout?: LayoutComponent<TLayoutProps>;

  /**
   * Optional props to pass to the layout component
   * These props are available as layoutProps in the LayoutProps.
   */
  layoutProps?: TLayoutProps;
}
