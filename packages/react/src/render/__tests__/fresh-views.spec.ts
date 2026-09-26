import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ViteDevServer } from 'vite';
import { FreshViews } from '../fresh-views';

function named(name: string, displayName?: string) {
  const fn = () => null;
  Object.defineProperty(fn, 'name', { value: name });
  return displayName ? Object.assign(fn, { displayName }) : fn;
}

describe('FreshViews', () => {
  let root: string;
  let modules: Record<string, unknown>;
  let vite: ViteDevServer;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'fresh-views-'));
    for (const file of [
      'src/views/recipe-list.tsx',
      'src/views/entry-server.tsx',
      'src/specials/views/recipe-list.tsx',
      'src/lib/recipe-list.tsx',
    ]) {
      mkdirSync(join(root, file, '..'), { recursive: true });
      writeFileSync(join(root, file), '');
    }
    modules = {
      '/src/views/recipe-list.tsx': { default: named('RecipeList') },
      '/src/specials/views/recipe-list.tsx': {
        default: named('x', 'SpecialsList'),
      },
    };
    vite = {
      ssrLoadModule: vi.fn((url: string) => Promise.resolve(modules[url])),
    } as unknown as ViteDevServer;
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('replaces the controller component with the current view source', async () => {
    const fresh = new FreshViews(vite, join(root, 'src'), root);
    const stale = named('RecipeList');
    const current = await fresh.component(stale);
    expect(current).toBe(
      (modules['/src/views/recipe-list.tsx'] as { default: unknown }).default,
    );
    expect(current).not.toBe(stale);
  });

  it('keeps the controller component when no view carries its exact name', async () => {
    const fresh = new FreshViews(vite, join(root, 'src'), root);
    const component = named('Unrelated');
    expect(await fresh.component(component)).toBe(component);
  });

  it('never considers entry files or files outside a views directory', async () => {
    const fresh = new FreshViews(vite, join(root, 'src'), root);
    await fresh.component(named('RecipeList'));
    const loaded = (vite.ssrLoadModule as ReturnType<typeof vi.fn>).mock.calls
      .map(([url]) => url as string)
      .sort();
    expect(loaded.every((url) => url.includes('/views/'))).toBe(true);
    expect(loaded.some((url) => url.includes('entry-'))).toBe(false);
  });

  it('refreshes layouts in the render payload', async () => {
    const fresh = new FreshViews(vite, join(root, 'src'), root);
    const payload = await fresh.payload({
      data: {},
      __layouts: [{ layout: named('RecipeList'), props: { a: 1 } }],
    } as never);
    expect(payload.__layouts?.[0].layout).toBe(
      (modules['/src/views/recipe-list.tsx'] as { default: unknown }).default,
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
