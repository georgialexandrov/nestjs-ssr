import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewModule } from '../resolve-component';
import { resolveViewComponent } from '../resolve-component';

// The module keeps a per-page cache of loaded views; reset it per test.
let loadViewModules: typeof import('../lazy-views').loadViewModules;
beforeEach(async () => {
  vi.resetModules();
  ({ loadViewModules } = await import('../lazy-views'));
});

function component(name: string) {
  const fn = () => null;
  Object.defineProperty(fn, 'name', { value: name });
  return fn;
}

function loadersFor(files: Record<string, string | { displayName: string }>) {
  const calls: string[] = [];
  const loaders: Record<string, () => Promise<ViewModule>> = {};
  for (const [path, spec] of Object.entries(files)) {
    loaders[path] = () => {
      calls.push(path);
      const c =
        typeof spec === 'string'
          ? component(spec)
          : Object.assign(component('x'), { displayName: spec.displayName });
      return Promise.resolve({ default: c });
    };
  }
  return { loaders, calls };
}

describe('loadViewModules', () => {
  it('loads only the page and layout files the names point to', async () => {
    const { loaders, calls } = loadersFor({
      '/src/views/recipe-list.tsx': 'RecipeList',
      '/src/views/recipes-layout.tsx': 'RecipesLayout',
      '/src/views/chef-profile.tsx': 'ChefProfile',
      '/src/views/home.tsx': 'Home',
    });
    const modules = await loadViewModules(loaders, [
      'RecipeList',
      'RecipesLayout',
    ]);
    expect(calls.sort()).toEqual([
      '/src/views/recipe-list.tsx',
      '/src/views/recipes-layout.tsx',
    ]);
    expect(resolveViewComponent('RecipeList', modules)?.name).toBe(
      'RecipeList',
    );
  });

  it('loads everything when the file holds a differently named component', async () => {
    // recipe-list.tsx declares "SpecialsList"; the real RecipeList lives
    // elsewhere. The eager resolver prefers the exact name, so must we.
    const { loaders, calls } = loadersFor({
      '/src/specials/views/recipe-list.tsx': { displayName: 'SpecialsList' },
      '/src/views/all-recipes.tsx': { displayName: 'RecipeList' },
      '/src/views/home.tsx': 'Home',
    });
    const modules = await loadViewModules(loaders, ['RecipeList']);
    expect(calls).toHaveLength(3);
    expect(
      (resolveViewComponent('RecipeList', modules) as { displayName?: string })
        ?.displayName,
    ).toBe('RecipeList');
  });

  it('loads everything when no file follows the convention', async () => {
    const { loaders, calls } = loadersFor({
      '/src/views/list.tsx': { displayName: 'SpecialsList' },
      '/src/views/home.tsx': 'Home',
    });
    await loadViewModules(loaders, ['SpecialsList']);
    expect(calls).toHaveLength(2);
  });

  it('loads everything for minified default names', async () => {
    const { loaders, calls } = loadersFor({
      '/src/views/a.tsx': 'default',
      '/src/views/b.tsx': 'default_1',
    });
    await loadViewModules(loaders, ['default_1']);
    expect(calls).toHaveLength(2);
  });

  it('never loads entry files and loads each module once', async () => {
    const { loaders, calls } = loadersFor({
      '/src/views/entry-client.tsx': 'Entry',
      '/src/views/home.tsx': 'Home',
    });
    await loadViewModules(loaders, ['Home']);
    await loadViewModules(loaders, ['Home']);
    expect(calls).toEqual(['/src/views/home.tsx']);
  });

  it('accumulates modules across navigations', async () => {
    const { loaders } = loadersFor({
      '/src/views/home.tsx': 'Home',
      '/src/views/about.tsx': 'About',
    });
    await loadViewModules(loaders, ['Home']);
    const modules = await loadViewModules(loaders, ['About']);
    expect(Object.keys(modules).sort()).toEqual([
      '/src/views/about.tsx',
      '/src/views/home.tsx',
    ]);
  });

  it('reuses eagerly imported views instead of loading them again', async () => {
    const { loaders, calls } = loadersFor({
      '/src/views/layout.tsx': 'RootLayout',
      '/src/views/home.tsx': 'Home',
      '/src/views/about.tsx': 'About',
    });
    const rootLayout = component('RootLayout');
    const modules = await loadViewModules(loaders, ['Home', 'RootLayout'], {
      preloaded: { '/src/views/layout.tsx': { default: rootLayout } },
    });
    expect(calls).toEqual(['/src/views/home.tsx']);
    expect(modules['/src/views/layout.tsx'].default).toBe(rootLayout);
  });

  it('loads every file sharing a stem and lets the exact name decide', async () => {
    const { loaders, calls } = loadersFor({
      '/src/views/recipe-list.tsx': 'RecipeList',
      '/src/specials/views/recipe-list.tsx': { displayName: 'SpecialsList' },
      '/src/views/home.tsx': 'Home',
    });
    const modules = await loadViewModules(loaders, ['RecipeList']);
    expect(calls.sort()).toEqual([
      '/src/specials/views/recipe-list.tsx',
      '/src/views/recipe-list.tsx',
    ]);
    expect(resolveViewComponent('RecipeList', modules)?.name).toBe(
      'RecipeList',
    );
  });

  describe('with the Vite plugin name index', () => {
    it('loads exactly the file the index names, whatever it is called', async () => {
      const { loaders, calls } = loadersFor({
        '/src/specials/views/recipe-list.tsx': { displayName: 'SpecialsList' },
        '/src/views/recipe-list.tsx': 'RecipeList',
        '/src/views/home.tsx': 'Home',
      });
      const modules = await loadViewModules(loaders, ['SpecialsList'], {
        index: { SpecialsList: ['src/specials/views/recipe-list.tsx'] },
      });
      expect(calls).toEqual(['/src/specials/views/recipe-list.tsx']);
      expect(
        (
          resolveViewComponent('SpecialsList', modules) as {
            displayName?: string;
          }
        )?.displayName,
      ).toBe('SpecialsList');
    });

    it('keeps the index for later navigations', async () => {
      const { loaders, calls } = loadersFor({
        '/src/views/home.tsx': 'Home',
        '/src/views/weekly.tsx': { displayName: 'SpecialsList' },
        '/src/views/about.tsx': 'About',
      });
      await loadViewModules(loaders, ['Home'], {
        index: {
          Home: ['src/views/home.tsx'],
          SpecialsList: ['src/views/weekly.tsx'],
        },
      });
      await loadViewModules(loaders, ['SpecialsList']);
      expect(calls).toEqual(['/src/views/home.tsx', '/src/views/weekly.tsx']);
    });

    it('falls back when the indexed file no longer carries the name', async () => {
      // A rename after the dev server computed the index.
      const { loaders, calls } = loadersFor({
        '/src/views/weekly.tsx': { displayName: 'Renamed' },
        '/src/views/specials-list.tsx': { displayName: 'SpecialsList' },
      });
      const modules = await loadViewModules(loaders, ['SpecialsList'], {
        index: { SpecialsList: ['src/views/weekly.tsx'] },
      });
      expect(calls.sort()).toEqual([
        '/src/views/specials-list.tsx',
        '/src/views/weekly.tsx',
      ]);
      expect(
        (
          resolveViewComponent('SpecialsList', modules) as {
            displayName?: string;
          }
        )?.displayName,
      ).toBe('SpecialsList');
    });
  });
});
