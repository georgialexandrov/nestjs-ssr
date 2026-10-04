import type { ViewModule, ViewModuleRegistry } from './resolve-component';
import { toPascalCase } from './resolve-component';

/**
 * Lazy view modules, as returned by Vite's
 * `import.meta.glob(pattern, { eager: false })`: path -> loader.
 */
export type ViewModuleLoaders = Record<string, () => Promise<ViewModule>>;

/**
 * Component name -> view files declaring it, relative to the Vite root, as
 * produced by the `nestjsSsr()` Vite plugin (`__NESTJS_SSR_VIEWS__`).
 */
export type ViewNameIndex = Record<string, string[]>;

/** Views this page already loaded, shared by initial hydration and navigation. */
const loaded: ViewModuleRegistry = {};
/** Loads in flight, so concurrent calls share one request per view. */
const loading: Record<string, Promise<void>> = {};

/** The name index from the first call that passed one, for navigation. */
let knownIndex: ViewNameIndex | undefined;

function fileStem(path: string): string {
  return (path.split('/').pop() ?? '').replace(/\.tsx?$/, '');
}

/**
 * Load the view modules needed to resolve `names` (the page component and its
 * layouts, as the server names them) and return every view loaded so far.
 *
 * A view is found through the Vite plugin's name index when there is one,
 * and otherwise by the naming convention the resolver already honours: the
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
    /**
     * Component name index from the Vite plugin. With it, a view is found by
     * its component name wherever its file lives; without it, by the file
     * naming convention. Kept for later calls (client navigation).
     */
    index?: ViewNameIndex;
  } = {},
): Promise<ViewModuleRegistry> {
  if (options.index) knownIndex = options.index;
  const index = options.index ?? knownIndex;
  for (const [path, module] of Object.entries(options.preloaded ?? {})) {
    loaded[path] ??= module;
  }
  const load = (path: string): unknown =>
    loaded[path] ??
    (loading[path] ??= loaders[path]().then((module) => {
      loaded[path] = module;
    }));

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
    const indexed = index?.[name]
      ?.map((file) => `/${file}`)
      .filter((path) => path in loaders);
    const lower = name.toLowerCase();
    const matches = indexed?.length
      ? indexed
      : paths.filter((path) => {
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
  return loaded;
}
