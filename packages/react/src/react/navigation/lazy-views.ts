import type { ViewModule, ViewModuleRegistry } from './resolve-component';
import { toPascalCase } from './resolve-component';

/**
 * Lazy view modules, as returned by Vite's
 * `import.meta.glob(pattern, { eager: false })`: path -> loader.
 */
export type ViewModuleLoaders = Record<string, () => Promise<ViewModule>>;

/** Views this page already loaded, shared by initial hydration and navigation. */
const loaded: ViewModuleRegistry = {};

function fileStem(path: string): string {
  return (path.split('/').pop() ?? '').replace(/\.tsx?$/, '');
}

/**
 * Load the view modules needed to resolve `names` (the page component and its
 * layouts, as the server names them) and return every view loaded so far.
 *
 * A view is found by the naming convention the resolver already honours: the
 * component `RecipeList` lives in `recipe-list.tsx` (or `RecipeList.tsx`).
 * Only those files are fetched, which is what makes a page's JavaScript
 * independent of how many other pages the app has.
 *
 * The resolver prefers an exact `displayName`/function name over a filename
 * match, and any file could declare that name. So a candidate is trusted only
 * when its component really carries the requested name. When it does not,
 * when no file matches the convention, or for minified `default` names, every
 * view is loaded and the resolver decides exactly as it does for eager
 * registries. Lazy loading can therefore never pick a different component
 * than the eager path would, only load less.
 */
export async function loadViewModules(
  loaders: ViewModuleLoaders,
  names: readonly string[],
  options: {
    /**
     * Views the entry already imported eagerly (such as the root layout).
     * A name one of them carries needs nothing loaded.
     */
    preloaded?: ViewModuleRegistry;
  } = {},
): Promise<ViewModuleRegistry> {
  for (const [path, module] of Object.entries(options.preloaded ?? {})) {
    loaded[path] ??= module;
  }
  const pending = new Map<string, Promise<void>>();
  const load = (path: string): Promise<void> => {
    if (loaded[path]) return Promise.resolve();
    let promise = pending.get(path);
    if (!promise) {
      promise = loaders[path]().then((module) => {
        loaded[path] = module;
      });
      pending.set(path, promise);
    }
    return promise;
  };

  const paths = Object.keys(loaders).filter(
    (path) => !fileStem(path).startsWith('entry-'),
  );

  const carries = (path: string, name: string): boolean => {
    const component = loaded[path]?.default;
    return (component?.displayName || component?.name) === name;
  };
  const loadedCarries = (name: string): boolean =>
    Object.keys(loaded).some((path) => carries(path, name));

  let needsAll = false;
  const wanted = names.filter((name) => !loadedCarries(name));
  const candidates = new Set<string>();
  for (const name of wanted) {
    if (/^default(_\d+)?$/.test(name)) {
      needsAll = true;
      break;
    }
    const lower = name.toLowerCase();
    const matches = paths.filter((path) => {
      const stem = fileStem(path);
      return toPascalCase(stem) === name || stem.toLowerCase() === lower;
    });
    if (matches.length === 0) {
      needsAll = true;
      break;
    }
    // Several files may share a stem across `views` directories; load them
    // all and let the exact name decide, as the eager resolver would.
    matches.forEach((path) => candidates.add(path));
  }

  if (!needsAll) {
    await Promise.all([...candidates].map(load));
    // Trust the convention only where a loaded file's component has the
    // exact name; otherwise another file may declare it.
    needsAll = wanted.some((name) => !loadedCarries(name));
  }

  if (needsAll) await Promise.all(paths.map(load));
  return { ...loaded };
}
