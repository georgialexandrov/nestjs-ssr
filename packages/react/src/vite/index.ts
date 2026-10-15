import { resolve } from 'path';
import type { Plugin, ResolvedConfig } from 'vite';
import {
  scanViewNames,
  viewComponentName,
  type ViewNameIndex,
} from './view-names';

export { viewComponentName } from './view-names';

/** Where the client build records view names, next to Vite's manifest. */
export const VIEW_NAMES_FILE = '.vite/nestjs-ssr-views.json';

/**
 * Vite plugin for @nestjs-ssr/react applications.
 *
 * The server names the page to hydrate by its component name
 * (`displayName` || function name), taken from the Nest build, which keeps
 * names. The plugin makes that name enough to find the view, whatever its
 * file is called:
 *
 * - It stamps each view's default-exported component with the name it was
 *   written with, as `displayName`, before minification, so the minified
 *   client still carries the name the server sends. It never overrides a
 *   `displayName` the view sets itself.
 * - It indexes views by component name. The client loads exactly the page's
 *   view by that index, and a production build writes it next to the Vite
 *   manifest (`.vite/nestjs-ssr-views.json`) so the server can preload that
 *   view's chunk.
 *
 * Without the plugin everything still works: views are then matched by the
 * file naming convention (`RecipeList` <-> `recipe-list.tsx`), and a view
 * that does not follow it makes the client load every view.
 *
 * ```ts
 * import { nestjsSsr } from '@nestjs-ssr/react/vite';
 * export default defineConfig({ plugins: [react(), nestjsSsr()] });
 * ```
 */
export function nestjsSsr(): Plugin {
  let config: ResolvedConfig | undefined;
  let index: ViewNameIndex = {};
  return {
    name: 'nestjs-ssr:view-names',
    // After the TSX/TS transform, so the code is plain JavaScript; still
    // before chunk rendering, where minification happens.
    enforce: 'post',
    config(userConfig) {
      // Paths are relative to the Vite root, the form of manifest keys and
      // (with a leading slash) of `import.meta.glob` keys.
      const root = resolve(userConfig.root ?? process.cwd());
      index = scanViewNames(root, root);
      return {
        define: { __NESTJS_SSR_VIEWS__: JSON.stringify(index) },
      };
    },
    configResolved(resolved) {
      config = resolved;
    },
    transform(code, id) {
      const name = viewComponentName(stripQuery(id), code);
      if (!name) return null;
      return {
        code: `${code}\n${stampDisplayName(name)}`,
        map: null,
      };
    },
    generateBundle() {
      if (!config || config.build.ssr) return;
      this.emitFile({
        type: 'asset',
        fileName: VIEW_NAMES_FILE,
        source: JSON.stringify(index),
      });
    },
  };
}

function stripQuery(id: string): string {
  const query = id.indexOf('?');
  return (query === -1 ? id : id.slice(0, query)).replace(/\\/g, '/');
}

/** Runs after the module body, so a view's own `displayName` wins. */
export function stampDisplayName(name: string): string {
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) {
    throw new Error(`Not a JavaScript identifier: ${JSON.stringify(name)}`);
  }
  return (
    `if (typeof ${name} === "function" && ` +
    `!Object.prototype.hasOwnProperty.call(${name}, "displayName")) ` +
    `${name}.displayName = ${JSON.stringify(name)};`
  );
}
