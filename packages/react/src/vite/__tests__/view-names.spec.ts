import { describe, expect, it } from 'vitest';
import { nestjsSsr, stampDisplayName, viewComponentName } from '../index';

describe('viewComponentName', () => {
  const view = '/app/src/views/recipe-list.tsx';

  it.each([
    ['export default function RecipeList(props) {}', 'RecipeList'],
    ['export default async function RecipeList() {}', 'RecipeList'],
    ['export default class RecipeList {}', 'RecipeList'],
    [
      'const RecipeList = () => null;\nexport default RecipeList;',
      'RecipeList',
    ],
    [
      'function RecipeList() {}\nexport { RecipeList as default };',
      'RecipeList',
    ],
  ])('finds the default export in %s', (code, name) => {
    expect(viewComponentName(view, code)).toBe(name);
  });

  it('ignores anonymous defaults, entry files, non-views and dependencies', () => {
    expect(viewComponentName(view, 'export default function () {}')).toBe(
      undefined,
    );
    const code = 'export default function Entry() {}';
    expect(viewComponentName('/app/src/views/entry-client.tsx', code)).toBe(
      undefined,
    );
    expect(viewComponentName('/app/src/components/card.tsx', code)).toBe(
      undefined,
    );
    expect(viewComponentName('/app/node_modules/x/views/page.tsx', code)).toBe(
      undefined,
    );
  });

  it('matches views in nested feature-module views directories', () => {
    expect(
      viewComponentName(
        '/app/src/specials/views/list.tsx',
        'export default function SpecialsList() {}',
      ),
    ).toBe('SpecialsList');
  });
});

describe('stampDisplayName', () => {
  it('names a component the way it was written, after minification', () => {
    // A minified function keeps working but loses its source name.
    const minified = function e() {};
    const run = new Function('RecipeList', stampDisplayName('RecipeList'));
    run(minified);
    expect((minified as { displayName?: string }).displayName).toBe(
      'RecipeList',
    );
  });

  it("never overrides the view's own displayName", () => {
    const component = Object.assign(function e() {}, {
      displayName: 'Custom',
    });
    new Function('RecipeList', stampDisplayName('RecipeList'))(component);
    expect(component.displayName).toBe('Custom');
  });
});

describe('nestjsSsr plugin', () => {
  it('appends the stamp to view modules only', () => {
    const plugin = nestjsSsr();
    const transform = plugin.transform as (
      code: string,
      id: string,
    ) => { code: string } | null;
    const code = 'export default function Home() {}';
    expect(transform(code, '/app/src/views/home.tsx?v=1')?.code).toContain(
      'Home.displayName = "Home"',
    );
    expect(transform(code, '/app/src/lib/home.tsx')).toBeNull();
  });
});
