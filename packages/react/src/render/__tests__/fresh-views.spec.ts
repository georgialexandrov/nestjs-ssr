import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ViteDevServer } from 'vite';
import { FreshViews } from '../dev/fresh-views';

function named(name: string, displayName?: string) {
  const fn = () => null;
  Object.defineProperty(fn, 'name', { value: name });
  return displayName ? Object.assign(fn, { displayName }) : fn;
}

describe('FreshViews', () => {
  let root: string;
  let modules: Record<string, { default: unknown }>;
  let vite: ViteDevServer;

  function write(file: string, source: string) {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), source);
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'fresh-views-'));
    write(
      'src/views/recipe-list.tsx',
      'export default function RecipeList() { return null; }',
    );
    write(
      'src/views/entry-server.tsx',
      'export default function RecipeList() {}',
    );
    // The file name does not follow the component name.
    write(
      'src/specials/views/recipe-list.tsx',
      'function SpecialsList() { return null; }\nexport default SpecialsList;',
    );
    write('src/lib/recipe-list.tsx', 'export default function RecipeList() {}');
    modules = {
      '/src/views/recipe-list.tsx': { default: named('RecipeList') },
      '/src/specials/views/recipe-list.tsx': { default: named('SpecialsList') },
    };
    vite = {
      ssrLoadModule: vi.fn((url: string) => Promise.resolve(modules[url])),
    } as unknown as ViteDevServer;
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const loadedUrls = () =>
    (vite.ssrLoadModule as ReturnType<typeof vi.fn>).mock.calls.map(
      ([url]) => url as string,
    );

  it('replaces the controller component with the current view source', async () => {
    const fresh = new FreshViews(vite, join(root, 'src'), root);
    const stale = named('RecipeList');
    const current = await fresh.component(stale);
    expect(current).toBe(modules['/src/views/recipe-list.tsx'].default);
    expect(current).not.toBe(stale);
  });

  it('finds a view by its component name, whatever the file is called', async () => {
    const fresh = new FreshViews(vite, join(root, 'src'), root);
    const current = await fresh.component(named('SpecialsList'));
    expect(current).toBe(
      modules['/src/specials/views/recipe-list.tsx'].default,
    );
  });

  it('keeps rendering the same file after the component is renamed', async () => {
    const fresh = new FreshViews(vite, join(root, 'src'), root);
    const controllerImport = named('SpecialsList');
    await fresh.component(controllerImport);

    // The edit renames the component; the controller still holds the old one.
    write(
      'src/specials/views/recipe-list.tsx',
      'export default function TodaysSpecials() { return null; }',
    );
    const renamed = named('TodaysSpecials');
    modules['/src/specials/views/recipe-list.tsx'] = { default: renamed };

    expect(await fresh.component(controllerImport)).toBe(renamed);
  });

  it('picks up a view file created after the first lookup', async () => {
    const fresh = new FreshViews(vite, join(root, 'src'), root);
    await fresh.component(named('RecipeList'));
    write(
      'src/views/chef-profile.tsx',
      'export default function ChefProfile() { return null; }',
    );
    const chef = named('ChefProfile');
    modules['/src/views/chef-profile.tsx'] = { default: chef };
    expect(await fresh.component(named('ChefProfile'))).toBe(chef);
  });

  it('keeps the controller component when no view carries its name, and stops looking', async () => {
    const fresh = new FreshViews(vite, join(root, 'src'), root);
    const component = named('Unrelated');
    expect(await fresh.component(component)).toBe(component);
    expect(await fresh.component(component)).toBe(component);
    expect(loadedUrls()).toEqual([]);
  });

  it('does not guess between views that share a component name', async () => {
    write(
      'src/admin/views/dashboard.tsx',
      'export default function Dashboard() {}',
    );
    write('src/views/dashboard.tsx', 'export default function Dashboard() {}');
    const fresh = new FreshViews(vite, join(root, 'src'), root);
    const component = named('Dashboard');
    expect(await fresh.component(component)).toBe(component);
    expect(loadedUrls()).toEqual([]);
  });

  it('never considers entry files or files outside a views directory', async () => {
    const fresh = new FreshViews(vite, join(root, 'src'), root);
    await fresh.component(named('RecipeList'));
    expect(loadedUrls()).toEqual(['/src/views/recipe-list.tsx']);
  });

  it('refreshes layouts in the render payload', async () => {
    const fresh = new FreshViews(vite, join(root, 'src'), root);
    const payload = await fresh.payload({
      data: {},
      __layouts: [{ layout: named('RecipeList'), props: { a: 1 } }],
    } as never);
    expect(payload.__layouts?.[0].layout).toBe(
      modules['/src/views/recipe-list.tsx'].default,
    );
    expect(payload.__layouts?.[0].props).toEqual({ a: 1 });
  });

  it('is enabled only by the dev runner', () => {
    const previous = process.env.NESTJS_SSR_FRESH_VIEWS;
    delete process.env.NESTJS_SSR_FRESH_VIEWS;
    expect(FreshViews.enabled()).toBe(false);
    process.env.NESTJS_SSR_FRESH_VIEWS = '1';
    expect(FreshViews.enabled()).toBe(true);
    if (previous === undefined) delete process.env.NESTJS_SSR_FRESH_VIEWS;
    else process.env.NESTJS_SSR_FRESH_VIEWS = previous;
  });
});
