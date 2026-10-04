import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveNestSsrProjectPaths } from '../nest-project-resolver';

describe('resolveNestSsrProjectPaths', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nestjs-ssr-resolver-'));
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
    delete process.env.NEST_SSR_PROJECT;
  });

  function writeJson(relativePath: string, data: unknown) {
    const fullPath = join(workspaceRoot, relativePath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, JSON.stringify(data, null, 2));
  }

  function writeText(relativePath: string, text: string) {
    const fullPath = join(workspaceRoot, relativePath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, text);
  }

  it('resolves standard single-app paths', () => {
    writeJson('nest-cli.json', {
      sourceRoot: 'src',
    });
    mkdirSync(join(workspaceRoot, 'src/views'), { recursive: true });

    const paths = resolveNestSsrProjectPaths({ cwd: workspaceRoot });

    expect(paths.projectName).toBe('default');
    expect(paths.projectRoot).toBe(workspaceRoot);
    expect(paths.sourceRoot).toBe(join(workspaceRoot, 'src'));
    expect(paths.viewsDir).toBe(join(workspaceRoot, 'src/views'));
    expect(paths.clientDistDir).toBe(join(workspaceRoot, 'dist/client'));
    expect(paths.serverDistDir).toBe(join(workspaceRoot, 'dist/server'));
    expect(paths.entryClientDev).toBe('/src/views/entry-client.tsx');
  });

  it('resolves monorepo application paths from nest-cli.json', () => {
    writeJson('nest-cli.json', {
      monorepo: true,
      root: 'apps/web',
      sourceRoot: 'apps/web/src',
      projects: {
        web: {
          type: 'application',
          root: 'apps/web',
          sourceRoot: 'apps/web/src',
          compilerOptions: {
            tsConfigPath: 'apps/web/tsconfig.app.json',
          },
        },
      },
    });
    writeJson('apps/web/tsconfig.app.json', {
      compilerOptions: {
        outDir: '../../dist/apps/web',
      },
    });
    mkdirSync(join(workspaceRoot, 'apps/web/src/views'), {
      recursive: true,
    });

    const paths = resolveNestSsrProjectPaths({
      cwd: workspaceRoot,
      project: 'web',
    });

    expect(paths.projectName).toBe('web');
    expect(paths.projectRoot).toBe(join(workspaceRoot, 'apps/web'));
    expect(paths.viewsDir).toBe(join(workspaceRoot, 'apps/web/src/views'));
    expect(paths.clientDistDir).toBe(
      join(workspaceRoot, 'dist/apps/web/client'),
    );
    expect(paths.serverDistDir).toBe(
      join(workspaceRoot, 'dist/apps/web/server'),
    );
    expect(paths.entryClientDev).toBe('/src/views/entry-client.tsx');
    expect(paths.viteRoot).toBe(join(workspaceRoot, 'apps/web'));
  });

  it('auto-detects monorepo project from main filename', () => {
    writeJson('nest-cli.json', {
      monorepo: true,
      root: 'apps/web',
      projects: {
        web: {
          type: 'application',
          root: 'apps/web',
          sourceRoot: 'apps/web/src',
          compilerOptions: {
            tsConfigPath: 'apps/web/tsconfig.app.json',
          },
        },
        api: {
          type: 'application',
          root: 'apps/api',
          sourceRoot: 'apps/api/src',
        },
      },
    });
    writeJson('apps/web/tsconfig.app.json', {
      compilerOptions: {
        outDir: '../../dist/apps/web',
      },
    });

    const paths = resolveNestSsrProjectPaths({
      cwd: workspaceRoot,
      mainFilename: join(workspaceRoot, 'dist/apps/web/main.js'),
    });

    expect(paths.projectName).toBe('web');
    expect(paths.viewsDir).toBe(join(workspaceRoot, 'apps/web/src/views'));
  });

  it('honors NEST_SSR_PROJECT environment variable', () => {
    writeJson('nest-cli.json', {
      monorepo: true,
      projects: {
        web: {
          type: 'application',
          root: 'apps/web',
          sourceRoot: 'apps/web/src',
        },
        api: {
          type: 'application',
          root: 'apps/api',
          sourceRoot: 'apps/api/src',
        },
      },
    });

    process.env.NEST_SSR_PROJECT = 'api';

    const paths = resolveNestSsrProjectPaths({ cwd: workspaceRoot });

    expect(paths.projectName).toBe('api');
    expect(paths.projectRoot).toBe(join(workspaceRoot, 'apps/api'));
  });

  it('supports custom viewsDir relative to project root', () => {
    writeJson('nest-cli.json', {
      sourceRoot: 'src',
    });

    const paths = resolveNestSsrProjectPaths({
      cwd: workspaceRoot,
      viewsDir: 'src/ui/pages',
    });

    expect(paths.viewsDir).toBe(join(workspaceRoot, 'src/ui/pages'));
    expect(paths.entryClientDev).toBe('/src/ui/pages/entry-client.tsx');
  });
  describe('tsconfig outDir', () => {
    beforeEach(() => {
      mkdirSync(join(workspaceRoot, 'src/views'), { recursive: true });
    });

    // tsconfig files are JSONC: Nest's own CLI and tsc accept comments and
    // trailing commas, so a real project's tsconfig.build.json can have them.
    it('reads a tsconfig with comments and trailing commas', () => {
      writeText(
        'tsconfig.build.json',
        `{
  // TypeScript 6 requires rootDir to be explicit
  "compilerOptions": {
    /* where nest build writes */
    "outDir": "./build", // trailing comment
  },
}`,
      );

      const paths = resolveNestSsrProjectPaths({ cwd: workspaceRoot });

      expect(paths.clientDistDir).toBe(join(workspaceRoot, 'build/client'));
    });

    it('keeps comment markers inside strings', () => {
      writeText(
        'tsconfig.build.json',
        `{ "compilerOptions": { "outDir": "./out//x/*y*/" } }`,
      );

      const paths = resolveNestSsrProjectPaths({ cwd: workspaceRoot });

      expect(paths.clientDistDir).toBe(join(workspaceRoot, 'out/x/*y*/client'));
    });

    it('inherits outDir through a relative extends', () => {
      writeJson('tsconfig.json', { compilerOptions: { outDir: './build' } });
      writeJson('tsconfig.build.json', {
        extends: './tsconfig.json',
        compilerOptions: { rootDir: './src' },
      });

      const paths = resolveNestSsrProjectPaths({ cwd: workspaceRoot });

      expect(paths.clientDistDir).toBe(join(workspaceRoot, 'build/client'));
    });

    it('resolves an inherited outDir against the config that declares it', () => {
      writeJson('config/tsconfig.base.json', {
        compilerOptions: { outDir: '../out' },
      });
      writeJson('tsconfig.build.json', {
        extends: './config/tsconfig.base.json',
      });

      const paths = resolveNestSsrProjectPaths({ cwd: workspaceRoot });

      expect(paths.clientDistDir).toBe(join(workspaceRoot, 'out/client'));
    });

    it('lets the extending config override outDir', () => {
      writeJson('tsconfig.json', { compilerOptions: { outDir: './base' } });
      writeJson('tsconfig.build.json', {
        extends: './tsconfig.json',
        compilerOptions: { outDir: './own' },
      });

      const paths = resolveNestSsrProjectPaths({ cwd: workspaceRoot });

      expect(paths.clientDistDir).toBe(join(workspaceRoot, 'own/client'));
    });

    it('falls back to dist when an extends cycle never sets outDir', () => {
      writeJson('a.json', { extends: './tsconfig.build.json' });
      writeJson('tsconfig.build.json', { extends: './a.json' });

      const paths = resolveNestSsrProjectPaths({ cwd: workspaceRoot });

      expect(paths.clientDistDir).toBe(join(workspaceRoot, 'dist/client'));
    });

    it('names the file when a tsconfig cannot be parsed', () => {
      writeText('tsconfig.build.json', '{ "compilerOptions": { outDir: } }');

      expect(() => resolveNestSsrProjectPaths({ cwd: workspaceRoot })).toThrow(
        /tsconfig\.build\.json/,
      );
    });
  });

  it('reads a nest-cli.json with comments', () => {
    writeText(
      'nest-cli.json',
      `{
  // generated by nest new
  "sourceRoot": "src",
}`,
    );
    mkdirSync(join(workspaceRoot, 'src/views'), { recursive: true });

    const paths = resolveNestSsrProjectPaths({ cwd: workspaceRoot });

    expect(paths.sourceRoot).toBe(join(workspaceRoot, 'src'));
  });
});
