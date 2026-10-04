import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  nestjsSsr,
  stampDisplayName,
  viewComponentName,
  VIEW_NAMES_FILE,
} from '../index';
import { scanViewNames } from '../view-names';

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

describe('view name index', () => {
  let root: string;

  function write(file: string, source: string) {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), source);
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'view-index-'));
    write('src/views/home.tsx', 'export default function Home() {}');
    write(
      'src/specials/views/recipe-list.tsx',
      'const SpecialsList = () => null;\nexport default SpecialsList;',
    );
    write('src/views/entry-client.tsx', 'export default function Entry() {}');
    write('src/views/anonymous.tsx', 'export default () => null;');
    write('src/lib/card.tsx', 'export default function Card() {}');
    // Build output and dependencies are never views.
    write('dist/src/views/home.js', 'export default function Stale() {}');
    write(
      'node_modules/pkg/views/page.tsx',
      'export default function Dep() {}',
    );
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('maps component names to view files, relative to the root', () => {
    expect(scanViewNames(root, root)).toEqual({
      Home: ['src/views/home.tsx'],
      SpecialsList: ['src/specials/views/recipe-list.tsx'],
    });
  });

  it('is defined for the client and emitted next to the client manifest', () => {
    const plugin = nestjsSsr();
    const config = (
      plugin.config as (c: { root: string }) => {
        define: Record<string, string>;
      }
    )({ root });
    expect(JSON.parse(config.define.__NESTJS_SSR_VIEWS__)).toEqual(
      scanViewNames(root, root),
    );

    (plugin.configResolved as (c: unknown) => void)({ build: { ssr: false } });
    const emitFile = vi.fn();
    (plugin.generateBundle as (this: unknown) => void).call({ emitFile });
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: VIEW_NAMES_FILE,
      source: JSON.stringify(scanViewNames(root, root)),
    });
  });

  it('emits nothing for the server build', () => {
    const plugin = nestjsSsr();
    (plugin.config as (c: { root: string }) => unknown)({ root });
    (plugin.configResolved as (c: unknown) => void)({ build: { ssr: 'x' } });
    const emitFile = vi.fn();
    (plugin.generateBundle as (this: unknown) => void).call({ emitFile });
    expect(emitFile).not.toHaveBeenCalled();
  });
});
