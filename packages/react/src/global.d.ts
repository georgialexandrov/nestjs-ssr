/**
 * Global type declarations for @nestjs-ssr/react
 *
 * This file is published as-is and re-exported at `@nestjs-ssr/react/global`,
 * so it may only import from paths that ship in the tarball — see the `files`
 * field in package.json.
 */

import type { RenderContext } from './interfaces/render-context.interface';
import type {
  PageData,
  SerializedLayout,
  ViewModule,
} from './interfaces/component.interface';

declare global {
  interface Window {
    /**
     * Initial state/props serialized from the server for hydration
     */
    __INITIAL_STATE__: PageData;

    /**
     * Render context serialized from the server for hydration.
     * Undefined until the server has written the hydration payload.
     */
    __CONTEXT__: RenderContext | undefined;

    /**
     * Component name for the current page
     */
    __COMPONENT_NAME__: string;

    /**
     * Layout metadata from the server for navigation
     */
    __LAYOUTS__: SerializedLayout[];

    /**
     * Module registry for segment hydration after client-side navigation.
     * Set by entry-client.tsx using Vite's import.meta.glob.
     */
    __MODULES__: Record<string, ViewModule>;

    /**
     * Lazy view loaders (Vite `import.meta.glob` with `eager: false`), set by
     * an entry-client.tsx that loads views per route. When present, client
     * navigation loads the target page's module before hydrating it.
     */
    __VIEW_LOADERS__?: Record<string, () => Promise<ViewModule>>;
  }

  interface ImportMeta {
    /**
     * Vite-specific glob import API
     * @see https://vite.dev/guide/features.html#glob-import
     */
    glob<T = unknown>(
      pattern: string | string[],
      options?: {
        eager?: boolean;
        import?: string;
        query?: string | Record<string, string | number | boolean>;
        as?: string;
      },
    ): Record<string, T>;
  }

  /**
   * View files by component name, defined by the `nestjsSsr()` Vite plugin.
   * Undeclared without it, so read it through `typeof`.
   */
  const __NESTJS_SSR_VIEWS__: Record<string, string[]> | undefined;
}

export {};
