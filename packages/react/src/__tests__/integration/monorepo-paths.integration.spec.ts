import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveNestSsrProjectPaths } from '../../config/nest-project-resolver';
import { RenderModule } from '../../render/render.module';
import { SSR_PROJECT_PATHS } from '../../config/nest-project-resolver';

describe('Monorepo SSR path integration', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nestjs-ssr-mono-int-'));

    writeFileSync(
      join(workspaceRoot, 'nest-cli.json'),
      JSON.stringify(
        {
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
          },
        },
        null,
        2,
      ),
    );

    mkdirSync(join(workspaceRoot, 'apps/web'), { recursive: true });
    writeFileSync(
      join(workspaceRoot, 'apps/web/tsconfig.app.json'),
      JSON.stringify(
        {
          compilerOptions: {
            outDir: '../../dist/apps/web',
          },
        },
        null,
        2,
      ),
    );

    mkdirSync(join(workspaceRoot, 'apps/web/src/views'), { recursive: true });
    writeFileSync(
      join(workspaceRoot, 'apps/web/src/views/index.html'),
      '<!DOCTYPE html><html><body><div id="root"><!--app-html--></div></body></html>',
    );
    writeFileSync(
      join(workspaceRoot, 'apps/web/src/views/entry-server.tsx'),
      'export function renderComponent() { return ""; }',
    );
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
    delete process.env.NEST_SSR_PROJECT;
  });

  it('resolves monorepo runtime paths for an active application', () => {
    const paths = resolveNestSsrProjectPaths({
      cwd: workspaceRoot,
      project: 'web',
    });

    expect(paths.entryClientDev).toBe('/src/views/entry-client.tsx');
    expect(paths.clientDistDir).toBe(
      join(workspaceRoot, 'dist/apps/web/client'),
    );
    expect(paths.templateDev).toBe(
      join(workspaceRoot, 'apps/web/src/views/index.html'),
    );
  });

  it('wires monorepo project config into RenderModule providers', () => {
    const previousCwd = process.cwd();
    process.chdir(workspaceRoot);

    try {
      const dynamicModule = RenderModule.forRoot({ project: 'web' });
      const pathsProvider = dynamicModule.providers?.find(
        (provider) =>
          typeof provider === 'object' &&
          provider !== null &&
          'provide' in provider &&
          provider.provide === SSR_PROJECT_PATHS,
      ) as { useValue?: { projectName: string; viewsDir: string } };

      expect(pathsProvider?.useValue?.projectName).toBe('web');
      expect(pathsProvider?.useValue?.viewsDir).toContain(
        join('apps', 'web', 'src', 'views'),
      );
    } finally {
      process.chdir(previousCwd);
    }
  });
});
