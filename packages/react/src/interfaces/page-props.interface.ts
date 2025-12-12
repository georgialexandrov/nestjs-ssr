import type { HeadData } from './render-response.interface';
import type { RenderContext } from './render-context.interface';

/**
 * Generic type for React page component props.
 * Spreads controller data directly as props (React-standard pattern).
 *
 * Request context is available via the usePageContext() hook instead of props.
 *
 * @template TProps - The shape of props returned by the controller
 *
 * @example
 * ```typescript
 * import { usePageContext } from '@nestjs-ssr/react';
 *
 * interface ProductPageProps {
 *   product: Product;
 *   relatedProducts: Product[];
 * }
 *
 * export default function ProductDetail(props: PageProps<ProductPageProps>) {
 *   const { product, relatedProducts, head } = props;
 *   const context = usePageContext(); // Access request context via hook
 *
 *   return (
 *     <html>
 *       <head>
 *         <title>{head?.title || product.name}</title>
 *       </head>
 *       <body>
 *         <h1>{product.name}</h1>
 *         <p>Current path: {context.path}</p>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export type PageProps<TProps = {}> = TProps & {
  /**
   * Optional head metadata for SEO (title, description, og tags, etc.)
   * Pass from controller to populate meta tags, Open Graph, etc.
   *
   * @example
   * ```typescript
   * // In controller:
   * return {
   *   product,
   *   head: {
   *     title: product.name,
   *     description: product.description,
   *   }
   * };
   *
   * // In component:
   * <head>
   *   <title>{props.head?.title}</title>
   *   <meta name="description" content={props.head?.description} />
   * </head>
   * ```
   */
  head?: HeadData;
};

/**
 * @deprecated Use PageProps with direct prop access and usePageContext() hook instead.
 * This interface will be removed in v1.0.0.
 *
 * @example
 * // Old way (deprecated):
 * function MyPage({ data, context }: PagePropsLegacy<{ users: User[] }>) {
 *   const { users } = data;
 * }
 *
 * // New way (recommended):
 * import { usePageContext } from '@nestjs-ssr/react';
 *
 * function MyPage(props: PageProps<{ users: User[] }>) {
 *   const { users } = props;
 *   const context = usePageContext(); // Access context via hook
 * }
 */
export interface PagePropsLegacy<TData = unknown> {
  data: TData;
  context: RenderContext;
}
