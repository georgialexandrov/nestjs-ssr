import { join } from 'path';
import type { NestSsrProjectPaths } from '../../config/nest-project-paths.interface';

export function createDefaultTestProjectPaths(
  workspaceRoot = '/project',
): NestSsrProjectPaths {
  const projectRoot = workspaceRoot;
  const sourceRoot = join(projectRoot, 'src');
  const viewsDir = join(sourceRoot, 'views');

  return {
    workspaceRoot,
    projectName: 'default',
    projectRoot,
    sourceRoot,
    viewsDir,
    viteRoot: projectRoot,
    aliasAt: sourceRoot,
    entryClientDev: '/src/views/entry-client.tsx',
    entryServerDev: '/src/views/entry-server.tsx',
    templateDev: join(viewsDir, 'index.html'),
    clientDistDir: join(projectRoot, 'dist/client'),
    serverDistDir: join(projectRoot, 'dist/server'),
    nestDistDir: join(projectRoot, 'dist'),
    layoutProbePaths: [
      'src/views/layout.tsx',
      'src/views/layout/index.tsx',
      'src/views/_layout.tsx',
    ],
  };
}
