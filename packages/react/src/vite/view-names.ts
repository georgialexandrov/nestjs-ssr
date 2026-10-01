import { readdirSync, readFileSync, type Dirent } from 'fs';
import { join, relative } from 'path';

/**
 * Views are named by their default-exported component (`displayName` or
 * function name): that is what `@Render(Component)` sends to the client and
 * what the client hydrates. This module finds those names in source, so a
 * view can be located by name wherever its file lives and whatever it is
 * called: `SpecialsList` in `specials/views/recipe-list.tsx` is found as
 * readily as `RecipeList` in `recipe-list.tsx`.
 */

const VIEW_FILE = /\/views\/(?:[^/]+\/)*(?!entry-)[^/]+\.[jt]sx?$/;
const IDENTIFIER = '[A-Za-z_$][\\w$]*';
const DEFAULT_EXPORTS = [
  new RegExp(
    `export\\s+default\\s+(?:async\\s+)?function\\s*\\*?\\s*(${IDENTIFIER})`,
  ),
  new RegExp(`export\\s+default\\s+class\\s+(${IDENTIFIER})`),
  new RegExp(`export\\s+default\\s+(${IDENTIFIER})\\s*;`),
  new RegExp(
    `export\\s*\\{[^}]*\\b(${IDENTIFIER})\\s+as\\s+default\\b[^}]*\\}`,
  ),
];

/** The local name of a view module's default-exported component, if any. */
export function viewComponentName(
  path: string,
  code: string,
): string | undefined {
  if (!VIEW_FILE.test(path) || path.includes('/node_modules/')) return;
  for (const pattern of DEFAULT_EXPORTS) {
    const match = pattern.exec(code);
    if (match) return match[1];
  }
  return undefined;
}

/**
 * Component name -> view files that declare it, relative to `relativeTo`
 * with POSIX separators (the form Vite uses for manifest keys). Only view
 * sources are read (`.tsx`/`.jsx` in a `views` directory, not `entry-*`);
 * build output, dependencies and dot-directories are skipped.
 */
export type ViewNameIndex = Record<string, string[]>;

export function scanViewNames(dir: string, relativeTo: string): ViewNameIndex {
  const index: ViewNameIndex = {};
  const walk = (current: string) => {
    let entries: Dirent[];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (
        entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name === 'dist'
      ) {
        continue;
      }
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.[jt]sx$/.test(entry.name)) continue;
      const file = relative(relativeTo, path).split('\\').join('/');
      let code: string;
      try {
        code = readFileSync(path, 'utf-8');
      } catch {
        continue;
      }
      const name = viewComponentName(`/${file}`, code);
      if (name) (index[name] ??= []).push(file);
    }
  };
  walk(dir);
  return index;
}
