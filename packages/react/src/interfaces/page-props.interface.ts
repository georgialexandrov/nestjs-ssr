import type { HeadData } from './render-response.interface';

/**
 * Generic type for React page component props.
 * Spreads controller data directly as props (React-standard pattern).
 *
 * Request context is available via typed hooks created with createSSRHooks().
 *
 * @template TProps - The shape of props returned by the controller
 *
 * @example
 * ```typescript
 * // src/lib/ssr-hooks.ts
 * import { createSSRHooks, RenderContext } from '@nestjs-ssr/react';
 *
 * interface AppRenderContext extends RenderContext {
 *   user?: User;
 * }
 *
 * export const { usePageContext } = createSSRHooks<AppRenderContext>();
 *
 * // src/views/product.tsx
 * import { usePageContext } from '@/lib/ssr-hooks';
 *
 * interface ProductPageProps {
 *   product: Product;
 *   relatedProducts: Product[];
 * }
 *
 * export default function ProductDetail(props: PageProps<ProductPageProps>) {
 *   const { product, relatedProducts, head } = props;
 *   const context = usePageContext(); // Fully typed!
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
