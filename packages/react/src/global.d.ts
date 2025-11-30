/**
 * Global type declarations for @nestjs-ssr/react
 */

declare global {
  interface Window {
    /**
     * Initial props serialized from the server for hydration
     */
    __INITIAL_PROPS__: any;

    /**
     * Render context serialized from the server for hydration
     */
    __RENDER_CONTEXT__: any;

    /**
     * View path for the current page
     */
    __VIEW_PATH__: string;
  }
}

export {};
