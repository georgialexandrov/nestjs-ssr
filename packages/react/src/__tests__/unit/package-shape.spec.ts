/**
 * The package's public shape is a compatibility contract. Applications and
 * bundlers resolve these exact entry points and condition names, so a build
 * tool change (tsup -> tsdown) or a refactor must not move, rename or drop
 * any of them. Changing this snapshot is a breaking change.
 */
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { join } from 'path';

const ROOT = join(__dirname, '../../..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as {
  main: string;
  module: string;
  types: string;
  bin: Record<string, string>;
  exports: Record<string, unknown>;
};

describe('published package shape', () => {
  it('keeps the 0.3.x entry points', () => {
    expect({
      main: pkg.main,
      module: pkg.module,
      types: pkg.types,
      bin: pkg.bin,
    }).toEqual({
      main: './dist/index.js',
      module: './dist/index.mjs',
      types: './dist/index.d.ts',
      bin: { 'nestjs-ssr': './dist/cli/init.mjs' },
    });
  });

  it('keeps the 0.3.x export map', () => {
    expect(pkg.exports).toEqual({
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.mjs',
        require: './dist/index.js',
      },
      './client': {
        types: './dist/client.d.ts',
        import: './dist/client.mjs',
        require: './dist/client.js',
      },
      './render': {
        types: './dist/render/index.d.ts',
        import: './dist/render/index.mjs',
        require: './dist/render/index.js',
      },
      './react/*': {
        types: './dist/react/*.d.ts',
        import: './dist/react/*.mjs',
        require: './dist/react/*.js',
      },
      './templates/*': './src/templates/*',
      './global': './src/global.d.ts',
      './package.json': './package.json',
    });
  });

  // Only meaningful after a build; CI builds before it tests the package.
  const built = existsSync(join(ROOT, 'dist/index.mjs'));
  it.skipIf(!built)('emits every file the export map points to', () => {
    const targets = [
      pkg.main,
      pkg.module,
      pkg.types,
      ...Object.values(pkg.bin),
      './dist/index.d.mts',
      './dist/client.mjs',
      './dist/client.js',
      './dist/client.d.ts',
      './dist/client.d.mts',
      './dist/render/index.mjs',
      './dist/render/index.js',
      './dist/render/index.d.ts',
      './dist/render/index.d.mts',
      './dist/cli/init.js',
      './dist/templates/entry-client.tsx',
      './dist/templates/entry-server.tsx',
      './dist/templates/index.html',
    ];
    const missing = targets.filter((target) => !existsSync(join(ROOT, target)));
    expect(missing).toEqual([]);
  });

  it.skipIf(!built)(
    'loads the CommonJS build with the same exports as ESM',
    async () => {
      const cjs = require(join(ROOT, 'dist/index.js')) as Record<
        string,
        unknown
      >;
      const esm = (await import(join(ROOT, 'dist/index.mjs'))) as Record<
        string,
        unknown
      >;
      expect(Object.keys(cjs).sort()).toEqual(
        Object.keys(esm)
          .filter((key) => key !== 'default')
          .sort(),
      );
    },
  );

  // Run in a fresh Node process: vitest defines CommonJS globals such as
  // `__dirname` itself, which would hide an ESM-only failure. Nest 12
  // applications are ES modules and load exactly this file.
  it.skipIf(!built)('configures RenderModule from a plain ES module', () => {
    const entry = pathToFileURL(join(ROOT, 'dist/index.mjs')).href;
    const script = [
      `const { RenderModule } = await import(${JSON.stringify(entry)});`,
      'const dynamicModule = RenderModule.forRoot();',
      "if (!dynamicModule.providers?.length) throw new Error('no providers');",
    ].join('\n');
    expect(() =>
      execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
});
