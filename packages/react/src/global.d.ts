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
      }
    ): Record<string, T>;
  }
}

export {};
