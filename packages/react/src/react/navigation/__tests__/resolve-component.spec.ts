import { describe, it, expect, vi } from 'vitest';
import type React from 'react';
import {
  resolveViewComponent,
  buildComponentRegistry,
  toPascalCase,
  type ViewModuleRegistry,
} from '../resolve-component';

/** Helper to build a glob-style module registry from [path, component] pairs. */
function registry(
  entries: Array<[string, React.ComponentType<any>]>,
): ViewModuleRegistry {
  return Object.fromEntries(entries.map(([path, c]) => [path, { default: c }]));
}

// Named components mimic `export default function X()` (function name = "X").
function makeComponent(name: string): React.ComponentType<any> {
  const c = () => null;
  Object.defineProperty(c, 'name', { value: name });
  return c;
}

describe('toPascalCase', () => {
  it('converts kebab-case to PascalCase', () => {
    expect(toPascalCase('recipe-list')).toBe('RecipeList');
    expect(toPascalCase('home')).toBe('Home');
    expect(toPascalCase('user-detail-page')).toBe('UserDetailPage');
  });
});

describe('buildComponentRegistry', () => {
  it('excludes entry files and modules without a default export', () => {
    const mods: ViewModuleRegistry = {
      '/src/views/home.tsx': { default: makeComponent('Home') },
      '/src/views/entry-client.tsx': { default: makeComponent('EntryClient') },
      '/src/views/entry-server.tsx': { default: makeComponent('EntryServer') },
      // No default export (e.g. a types-only module)
      '/src/views/types.tsx': {} as any,
    };
    const built = buildComponentRegistry(mods);
    expect(built.map((c) => c.path)).toEqual(['/src/views/home.tsx']);
  });
});

describe('resolveViewComponent', () => {
  it('resolves a top-level view by displayName/function name', () => {
    const Home = makeComponent('Home');
    const mods = registry([['/src/views/home.tsx', Home]]);
    expect(resolveViewComponent('Home', mods)).toBe(Home);
  });

  it('resolves a submodule view colocated in a feature module', () => {
    // Reproduces the original glob gap: views nested in feature modules must
    // be resolvable just like top-level ones.
    const ProductList = makeComponent('ProductList');
    const mods = registry([
      ['/src/views/home.tsx', makeComponent('Home')],
      ['/src/products/views/product-list.tsx', ProductList],
    ]);
    expect(resolveViewComponent('ProductList', mods)).toBe(ProductList);
  });

  it('resolves a kebab-case filename for an anonymous default export', () => {
    // Regression: segment navigation previously used a naive capitalizer that
    // turned "recipe-list" into "Recipe-list", so kebab-named views resolved on
    // first load but failed on client-side navigation. Both must agree now.
    const RecipeList = makeComponent('default'); // anonymous-ish default export
    const mods = registry([['/src/recipes/views/recipe-list.tsx', RecipeList]]);
    expect(resolveViewComponent('RecipeList', mods)).toBe(RecipeList);
  });

  describe('same-name collision across submodules', () => {
    it('reports the collision and resolves deterministically', () => {
      // Two different components named "RecipeList" in different views dirs.
      const RootRecipeList = makeComponent('RecipeList');
      const SpecialsRecipeList = makeComponent('RecipeList');
      const mods = registry([
        ['/src/views/recipe-list.tsx', RootRecipeList],
        ['/src/specials/views/recipe-list.tsx', SpecialsRecipeList],
      ]);

      const onCollision = vi.fn();
      const resolved = resolveViewComponent('RecipeList', mods, {
        onCollision,
      });

      // Collision surfaced with both offending paths (sorted), not silent.
      expect(onCollision).toHaveBeenCalledTimes(1);
      expect(onCollision.mock.calls[0][0]).toBe('RecipeList');
      expect(onCollision.mock.calls[0][1]).toEqual([
        '/src/specials/views/recipe-list.tsx',
        '/src/views/recipe-list.tsx',
      ]);

      // Deterministic fallback: first by sorted path (not glob/insertion order).
      expect(resolved).toBe(SpecialsRecipeList);
    });

    it('does NOT report a collision when the same module appears once', () => {
      const Home = makeComponent('Home');
      const mods = registry([['/src/views/home.tsx', Home]]);
      const onCollision = vi.fn();
      resolveViewComponent('Home', mods, { onCollision });
      expect(onCollision).not.toHaveBeenCalled();
    });

    it('prefers exact displayName over an incidental normalized-filename match', () => {
      // The real-world repro: a submodule file `recipe-list.tsx` whose component
      // is `SpecialsList`. Its basename normalizes to "RecipeList", colliding by
      // FILENAME with the root view whose displayName is actually "RecipeList".
      // Resolving "RecipeList" must return the root view by exact name (no false
      // collision), and "SpecialsList" must return the submodule view.
      const RootRecipeList = makeComponent('RecipeList');
      const SpecialsList = makeComponent('SpecialsList');
      const mods = registry([
        ['/src/views/recipe-list.tsx', RootRecipeList],
        ['/src/specials/views/recipe-list.tsx', SpecialsList],
      ]);

      const onCollision = vi.fn();
      expect(resolveViewComponent('RecipeList', mods, { onCollision })).toBe(
        RootRecipeList,
      );
      expect(resolveViewComponent('SpecialsList', mods, { onCollision })).toBe(
        SpecialsList,
      );
      expect(onCollision).not.toHaveBeenCalled();
    });

    it('does NOT report a collision for distinct names that share a basename', () => {
      // Same filename "list.tsx" in two modules but unique displayNames — the
      // recommended pattern — must resolve precisely with no warning.
      const ProductList = makeComponent('ProductList');
      const OrderList = makeComponent('OrderList');
      const mods = registry([
        ['/src/products/views/list.tsx', ProductList],
        ['/src/orders/views/list.tsx', OrderList],
      ]);
      const onCollision = vi.fn();
      expect(resolveViewComponent('ProductList', mods, { onCollision })).toBe(
        ProductList,
      );
      expect(resolveViewComponent('OrderList', mods, { onCollision })).toBe(
        OrderList,
      );
      expect(onCollision).not.toHaveBeenCalled();
    });
  });

  it('resolves minified anonymous defaults by index', () => {
    const A = makeComponent('default');
    const B = makeComponent('default');
    const mods = registry([
      ['/src/views/a.tsx', A],
      ['/src/views/b.tsx', B],
    ]);
    // default_1 -> first by path, default_2 -> second by path
    expect(resolveViewComponent('default_1', mods)).toBe(A);
    expect(resolveViewComponent('default_2', mods)).toBe(B);
  });

  it('returns undefined when no component matches', () => {
    const mods = registry([['/src/views/home.tsx', makeComponent('Home')]]);
    expect(resolveViewComponent('DoesNotExist', mods)).toBeUndefined();
  });
});
