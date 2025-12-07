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
     * Component path for the current page
     */
    __COMPONENT_PATH__: string;
  }
}

/**
 * Module declaration for generated view registry
 * This file is generated at build time in user applications
 */
declare module '@/views/view-registry.generated' {
  export const viewRegistry: Record<string, React.ComponentType<any>>;
}

export {};
