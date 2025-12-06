/**
 * HTML head data for SEO and page metadata
 */
export interface HeadData {
  /** Page title (appears in browser tab and search results) */
  title?: string;

  /** Page description for search engines */
  description?: string;

  /** Page keywords (legacy, less important for modern SEO) */
  keywords?: string;

  /** Canonical URL for duplicate content */
  canonical?: string;

  /** Open Graph title for social media sharing */
  ogTitle?: string;

  /** Open Graph description for social media sharing */
  ogDescription?: string;

  /** Open Graph image URL for social media previews */
  ogImage?: string;

  /** Additional link tags (fonts, icons, preloads, etc.) */
  links?: Array<{
    rel: string;
    href: string;
    as?: string;
    type?: string;
    crossorigin?: string;
    [key: string]: any;
  }>;

  /** Additional meta tags */
  meta?: Array<{
    name?: string;
    property?: string;
    content: string;
    [key: string]: any;
  }>;
}

/**
 * Response structure for SSR rendering
 *
 * Can be returned from controllers decorated with @ReactRender.
 * For backwards compatibility, controllers can also return plain objects
 * which will be auto-wrapped as { props: data }.
 *
 * @example
 * ```typescript
 * // Simple case - just props (auto-wrapped)
 * @ReactRender('views/home')
 * getHome() {
 *   return { message: 'Hello' };
 *   // Treated as: { props: { message: 'Hello' } }
 * }
 *
 * // Advanced case - with head data
 * @ReactRender('views/user')
 * getUser(@Param('id') id: string) {
 *   const user = await this.userService.findOne(id);
 *   return {
 *     props: { user },
 *     head: {
 *       title: `${user.name} - Profile`,
 *       description: user.bio,
 *       ogImage: user.avatar
 *     }
 *   };
 * }
 * ```
 */
export interface RenderResponse<T = any> {
  /** Props passed to the React component */
  props: T;

  /** HTML head data (title, meta tags, links) */
  head?: HeadData;
}
