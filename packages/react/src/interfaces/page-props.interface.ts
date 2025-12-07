import type { RenderContext } from './render-context.interface';
import type { HeadData } from './render-response.interface';

/**
 * Generic interface for React page component props.
 * Spreads controller data directly as props (React-standard pattern).
 *
 * @template TProps - The shape of props returned by the controller
 *
 * @example
 * ```typescript
 * interface ProductPageProps {
 *   product: Product;
 *   relatedProducts: Product[];
 * }
 *
 * export default function ProductDetail(props: PageProps<ProductPageProps>) {
 *   const { product, relatedProducts, head, context } = props;
 *   return (
 *     <html>
 *       <head>
 *         <title>{head?.title || product.name}</title>
 *       </head>
 *       <body>
 *         <h1>{product.name}</h1>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export interface PageProps<TProps = {}> extends TProps {
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

  /**
   * Request context containing URL metadata and safe headers.
   * Always available on every page component.
   *
   * @example
   * ```typescript
   * const { path, query, method } = props.context;
   * ```
   */
  context: RenderContext;
}

/**
 * @deprecated Use PageProps with direct prop access instead.
 * This interface will be removed in v1.0.0.
 *
 * @example
 * // Old way (deprecated):
 * function MyPage({ data, context }: PagePropsLegacy<{ users: User[] }>) {
 *   const { users } = data;
 * }
 *
 * // New way (recommended):
 * function MyPage(props: PageProps<{ users: User[] }>) {
 *   const { users, context } = props;
 * }
 */
export interface PagePropsLegacy<TData = unknown> {
  data: TData;
  context: RenderContext;
}
