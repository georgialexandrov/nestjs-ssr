/**
 * Global type declarations
 */

declare global {
  interface Window {
    /**
     * Initial state serialized from the server for hydration
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
}

export {};
