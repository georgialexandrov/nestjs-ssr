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
});
