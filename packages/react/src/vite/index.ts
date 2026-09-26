import type { Plugin } from 'vite';

/**
 * Vite plugin for @nestjs-ssr/react applications.
 *
 * The server names the page to hydrate by its component name
 * (`displayName` || function name), taken from the Nest build, which keeps
 * names. A production Vite build minifies the client's copy of the same
 * function, so its `name` no longer matches. Views that set `displayName`
 * are unaffected; for the rest, the client cannot tell which lazily loaded
 * view the server meant without loading all of them.
 *
 * This stamps each view's default-exported component with the name it was
 * written with, as `displayName`, before minification. It only touches files
 * in a `views` directory (not `entry-*` files), never overrides a
 * `displayName` the view sets itself, and costs a few bytes per view, unlike
 * keeping every name in the bundle.
 *
 * ```ts
 * import { nestjsSsr } from '@nestjs-ssr/react/vite';
 * export default defineConfig({ plugins: [react(), nestjsSsr()] });
 * ```
 */
export function nestjsSsr(): Plugin {
  return {
    name: 'nestjs-ssr:view-names',
    // After the TSX/TS transform, so the code is plain JavaScript; still
    // before chunk rendering, where minification happens.
    enforce: 'post',
    transform(code, id) {
      const name = viewComponentName(stripQuery(id), code);
      if (!name) return null;
      return {
        code: `${code}\n${stampDisplayName(name)}`,
        map: null,
      };
    },
  };
}

const VIEW_FILE = /\/views\/(?:[^/]+\/)*(?!entry-)[^/]+\.[jt]sx?$/;
const IDENTIFIER = '[A-Za-z_$][\\w$]*';

function stripQuery(id: string): string {
  const query = id.indexOf('?');
  return (query === -1 ? id : id.slice(0, query)).replace(/\\/g, '/');
}

/** The local name of a view module's default-exported component, if any. */
export function viewComponentName(
  path: string,
  code: string,
): string | undefined {
  if (!VIEW_FILE.test(path) || path.includes('/node_modules/')) return;
  const patterns = [
    new RegExp(
      `export\\s+default\\s+(?:async\\s+)?function\\s*\\*?\\s*(${IDENTIFIER})`,
    ),
    new RegExp(`export\\s+default\\s+class\\s+(${IDENTIFIER})`),
    new RegExp(`export\\s+default\\s+(${IDENTIFIER})\\s*;`),
    new RegExp(
      `export\\s*\\{[^}]*\\b(${IDENTIFIER})\\s+as\\s+default\\b[^}]*\\}`,
    ),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(code);
    if (match) return match[1];
  }
  return undefined;
}

/** Runs after the module body, so a view's own `displayName` wins. */
export function stampDisplayName(name: string): string {
  return (
    `if (typeof ${name} === "function" && ` +
    `!Object.prototype.hasOwnProperty.call(${name}, "displayName")) ` +
    `${name}.displayName = ${JSON.stringify(name)};`
  );
}
