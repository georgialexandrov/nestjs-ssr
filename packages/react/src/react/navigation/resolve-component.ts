import type React from 'react';

/**
 * Shared view-component resolution used by both the initial hydration entry
 * (`entry-client.tsx`) and client-side segment navigation (`hydrate-segment.tsx`).
 *
 * Components are discovered with Vite's `import.meta.glob` over every `views`
 * directory in the project (including those colocated inside feature modules,
 * e.g. `@/products/views/list.tsx`). The server can only communicate *which*
 * component to hydrate by its name (`displayName` || function name), because the
 * component instance the server renders comes from the Nest build and is never
 * identity-equal to the Vite-bundled module. That makes the name the contract,
 * so it must be unique across all `views` directories.
 *
 * This module centralizes the matching logic so both call sites stay in sync
 * (previously they normalized filenames differently — `recipe-list` resolved on
 * first load but failed on client navigation) and so same-name collisions across
 * submodules surface a clear error instead of silently hydrating the wrong view.
 */

export interface ViewModule {
  default: React.ComponentType<any>;
}

export type ViewModuleRegistry = Record<string, ViewModule>;

export interface ComponentEntry {
  /** The glob key, e.g. `/src/products/views/list.tsx`. Unique per file. */
  path: string;
  component: React.ComponentType<any>;
  /** `displayName` || function name, if any. */
  name?: string;
  /** Filename without extension, e.g. `recipe-list`. */
  filename?: string;
  /** Filename converted to PascalCase, e.g. `RecipeList`. */
  normalizedFilename?: string;
}

/** Convert kebab-case filename to PascalCase (e.g. "recipe-list" -> "RecipeList"). */
export function toPascalCase(str: string): string {
  return str.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase());
}

/** Files that are SSR/client entry points, never page components. */
function isEntryFile(filename: string): boolean {
  return /^entry-/.test(filename);
}

/**
 * Build the list of resolvable view components from a glob module registry.
 * Entry files and modules without a default export are excluded.
 */
export function buildComponentRegistry(
  modules: ViewModuleRegistry,
): ComponentEntry[] {
  return Object.entries(modules)
    .filter(([path, module]) => {
      const filename = path.split('/').pop() ?? '';
      if (isEntryFile(filename)) return false;
      return module?.default !== undefined;
    })
    .map(([path, module]) => {
      const component = module.default;
      const name = component.displayName || component.name || undefined;
      const filename = path
        .split('/')
        .pop()
        ?.replace(/\.tsx?$/, '');
      const normalizedFilename = filename ? toPascalCase(filename) : undefined;
      return { path, component, name, filename, normalizedFilename };
    });
}

export interface ResolveOptions {
  /**
   * Called when a name resolves to more than one distinct component (a
   * collision across `views` directories). Receives the requested name and the
   * sorted list of colliding file paths. Defaults to `console.error`.
   */
  onCollision?: (name: string, paths: string[]) => void;
}

function reportCollision(name: string, paths: string[]): void {
  console.error(
    `[nestjs-ssr] Multiple view components resolve to the name "${name}":\n` +
      paths.map((p) => `  - ${p}`).join('\n') +
      `\nView component names must be unique across all "views" directories. ` +
      `Give the components distinct names by setting a unique \`displayName\` ` +
      `(or renaming the files). Falling back to the first match by path.`,
  );
}

/**
 * Resolve a view component by the name the server sent for hydration.
 *
 * Matching is tiered by precedence (mirrors the server's `displayName || name`
 * identifier); the first non-empty tier wins:
 *   1. exact `displayName` / function name
 *   2. normalized (PascalCase) filename, e.g. "recipe-list.tsx" -> "RecipeList"
 *   3. raw filename (case-insensitive)
 *   4. minified anonymous defaults ("default", "default_1", ...)
 *
 * Tiering matters: a submodule view `recipe-list.tsx` (displayName "SpecialsList")
 * normalizes to "RecipeList", so a flat match would tie it with the *real*
 * `RecipeList` and mis-resolve. By preferring the exact-name tier, the explicit
 * `displayName` always wins over an incidental filename collision.
 *
 * A collision is only reported when the *winning* tier itself contains more than
 * one distinct component — i.e. the name is genuinely ambiguous (e.g. two files
 * both `displayName = "RecipeList"`). In that case `onCollision` is invoked and
 * resolution falls back to the first match by sorted path for determinism.
 */
export function resolveViewComponent(
  name: string,
  modules: ViewModuleRegistry,
  options: ResolveOptions = {},
): React.ComponentType<any> | undefined {
  const registry = buildComponentRegistry(modules);
  const lower = name.toLowerCase();

  const tiers = [
    registry.filter((c) => c.name === name),
    registry.filter((c) => c.normalizedFilename === name),
    registry.filter((c) => c.filename === lower),
  ];

  for (const tier of tiers) {
    if (tier.length === 0) continue;

    const distinct = new Set(tier.map((c) => c.component));
    if (distinct.size > 1) {
      const sorted = tier.slice().sort((a, b) => a.path.localeCompare(b.path));
      (options.onCollision ?? reportCollision)(
        name,
        sorted.map((c) => c.path),
      );
      return sorted[0].component;
    }
    return tier[0].component;
  }

  // Minified anonymous default exports: "default", "default_1", "default_2", ...
  if (/^default(_\d+)?$/.test(name)) {
    if (registry.length === 1) {
      return registry[0].component;
    }
    const indexMatch = name.match(/^default_(\d+)$/);
    const index = indexMatch ? parseInt(indexMatch[1], 10) - 1 : 0;
    const defaults = registry
      .filter((c) => c.name === 'default')
      .sort((a, b) => a.path.localeCompare(b.path));
    return defaults[index]?.component;
  }

  return undefined;
}
