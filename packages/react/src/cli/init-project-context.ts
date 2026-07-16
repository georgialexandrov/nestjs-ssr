import { existsSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { resolveNestSsrProjectPaths } from '../config/nest-project-resolver.js';
import type { NestSsrProjectPaths } from '../config/nest-project-paths.interface.js';

interface NestCliProjectEntry {
  type?: string;
  root?: string;
  sourceRoot?: string;
  compilerOptions?: {
    tsConfigPath?: string;
  };
}

interface NestCliConfig {
  monorepo?: boolean;
  projects?: Record<string, NestCliProjectEntry>;
}

export interface InitProjectContext {
  workspaceRoot: string;
  projectName: string;
  projectRoot: string;
  sourceRoot: string;
  viewsDirAbs: string;
  viewsDirRel: string;
  paths: NestSsrProjectPaths;
  tsconfigPath: string;
  tsconfigBuildPath: string;
  viteConfigPath: string;
  clientOutDirRel: string;
  serverOutDirRel: string;
  isMonorepo: boolean;
}

export function resolveInitProjectContext(options: {
  cwd: string;
  project?: string;
  viewsDir?: string;
}): InitProjectContext {
  const workspaceRoot = options.cwd;
  const nestCliPath = join(workspaceRoot, 'nest-cli.json');
  const nestCli = existsSync(nestCliPath)
    ? (JSON.parse(readFileSync(nestCliPath, 'utf-8')) as NestCliConfig)
    : null;

  const applicationProjects = Object.entries(nestCli?.projects ?? {}).filter(
    ([, entry]) => entry.type === 'application' || !entry.type,
  );
  const isMonorepo = Boolean(
    nestCli?.monorepo && applicationProjects.length > 0,
  );

  let projectName = options.project;
  if (isMonorepo && applicationProjects.length > 1 && !projectName) {
    throw new Error(
      'Monorepo detected with multiple applications. Pass --project <name>.',
    );
  }

  if (!projectName && applicationProjects.length === 1) {
    projectName = applicationProjects[0][0];
  }

  const paths = resolveNestSsrProjectPaths({
    cwd: workspaceRoot,
    project: projectName,
    viewsDir: options.viewsDir,
  });

  const projectEntry =
    projectName && nestCli?.projects?.[projectName]
      ? nestCli.projects[projectName]
      : undefined;

  const tsconfigPath = projectEntry?.compilerOptions?.tsConfigPath
    ? join(workspaceRoot, projectEntry.compilerOptions.tsConfigPath)
    : join(workspaceRoot, 'tsconfig.json');

  const tsconfigBuildPath = existsSync(
    join(workspaceRoot, 'tsconfig.build.json'),
  )
    ? join(workspaceRoot, 'tsconfig.build.json')
    : isMonorepo
      ? tsconfigPath
      : join(workspaceRoot, 'tsconfig.build.json');

  const viewsDirRel = relative(paths.projectRoot, paths.viewsDir).replace(
    /\\/g,
    '/',
  );

  return {
    workspaceRoot,
    projectName: paths.projectName,
    projectRoot: paths.projectRoot,
    sourceRoot: paths.sourceRoot,
    viewsDirAbs: paths.viewsDir,
    viewsDirRel,
    paths,
    tsconfigPath,
    tsconfigBuildPath,
    viteConfigPath: join(paths.projectRoot, 'vite.config.ts'),
    clientOutDirRel: relative(paths.projectRoot, paths.clientDistDir).replace(
      /\\/g,
      '/',
    ),
    serverOutDirRel: relative(paths.projectRoot, paths.serverDistDir).replace(
      /\\/g,
      '/',
    ),
    isMonorepo,
  };
}

export function buildRenderModuleConfig(
  projectName: string,
  vitePort: number,
): string {
  const configParts: string[] = [];
  if (projectName !== 'default') {
    configParts.push(`project: '${projectName}'`);
  }
  if (vitePort !== 5173) {
    configParts.push(`vite: { port: ${vitePort} }`);
  }

  if (configParts.length === 0) {
    return 'RenderModule.forRoot()';
  }

  return `RenderModule.forRoot({ ${configParts.join(', ')} })`;
}
