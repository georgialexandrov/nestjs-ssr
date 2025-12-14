/**
 * Global type declarations for @nestjs-ssr/react
 */

declare global {
  interface Window {
    /**
     * Initial state/props serialized from the server for hydration
     */
    __INITIAL_STATE__: any;

    /**
     * Render context serialized from the server for hydration
     */
    __CONTEXT__: any;

    /**
     * Component name for the current page
     */
    __COMPONENT_NAME__: string;

    /**
     * Layout metadata from the server for navigation
     */
    __LAYOUTS__: Array<{ name: string; props?: any }>;

    /**
     * Module registry for segment hydration after client-side navigation.
     * Set by entry-client.tsx using Vite's import.meta.glob.
     */
    __MODULES__: Record<string, { default: React.ComponentType<any> }>;
  }

  interface ImportMeta {
    /**
     * Vite-specific glob import API
     * @see https://vite.dev/guide/features.html#glob-import
     */
    glob<T = any>(
      pattern: string | string[],
      options?: {
        eager?: boolean;
        import?: string;
        query?: string | Record<string, string | number | boolean>;
        as?: string;
      },
    ): Record<string, T>;
  }
}

export {};
