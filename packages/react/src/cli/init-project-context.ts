import { existsSync, readFileSync } from 'fs';
import { dirname, join, relative } from 'path';
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
  mode: 'string' | 'stream' = 'string',
): string {
  // New projects render an error page (development: with diagnostics) when a
  // page throws, instead of Nest's JSON 500. Existing apps opt in explicitly.
  const configParts: string[] = ['showErrorPage: true'];
  if (mode === 'stream') {
    configParts.push(`mode: 'stream'`);
  }
  if (projectName !== 'default') {
    configParts.push(`project: '${projectName}'`);
  }
  if (vitePort !== 5173) {
    configParts.push(`vite: { port: ${vitePort} }`);
  }

  return `RenderModule.forRoot({ ${configParts.join(', ')} })`;
}

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

const PACKAGE_MANAGERS: readonly PackageManager[] = [
  'pnpm',
  'npm',
  'yarn',
  'bun',
];

/**
 * The project's package manager: an explicit choice first, then its lockfile,
 * then whichever manager launched `init` (npx, pnpm dlx, yarn dlx, bunx set
 * npm_config_user_agent), then npm.
 */
export function detectPackageManager(
  cwd: string,
  explicit?: string,
  userAgent = process.env.npm_config_user_agent ?? '',
): PackageManager {
  if (explicit && (PACKAGE_MANAGERS as readonly string[]).includes(explicit)) {
    return explicit as PackageManager;
  }
  const lockfiles: Array<[string, PackageManager]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm'],
  ];
  for (let dir = cwd; ; dir = dirname(dir)) {
    for (const [file, manager] of lockfiles) {
      if (existsSync(join(dir, file))) return manager;
    }
    if (dirname(dir) === dir) break;
  }
  const agent = userAgent.split('/')[0];
  return (PACKAGE_MANAGERS as readonly string[]).includes(agent)
    ? (agent as PackageManager)
    : 'npm';
}

/** The command that runs a package.json script with `manager`. */
export function runScriptCommand(
  manager: PackageManager,
  script: string,
): string {
  return manager === 'npm' || manager === 'bun'
    ? `${manager} run ${script}`
    : `${manager} ${script}`;
}

/** The `concurrently` shorthand that runs a script with `manager`. */
export function concurrentlyScript(
  manager: PackageManager,
  script: string,
): string {
  return `"${manager}:${script}"`;
}
