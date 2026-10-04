import { existsSync, readFileSync } from 'fs';
import { dirname, join, normalize, relative, resolve } from 'path';
import { parseJsonc } from './jsonc';
import type {
  NestSsrProjectPaths,
  ResolveNestSsrProjectPathsOptions,
} from './nest-project-paths.interface';

export const SSR_PROJECT_PATHS = 'SSR_PROJECT_PATHS';

interface NestCliSsrOptions {
  viewsDir?: string;
  vitePort?: number;
}

interface NestCliProjectEntry {
  type?: string;
  root?: string;
  entryFile?: string;
  sourceRoot?: string;
  compilerOptions?: {
    tsConfigPath?: string;
  };
  ssr?: NestCliSsrOptions;
}

interface NestCliConfig {
  monorepo?: boolean;
  root?: string;
  sourceRoot?: string;
  projects?: Record<string, NestCliProjectEntry>;
  compilerOptions?: {
    tsConfigPath?: string;
  };
}

const DEFAULT_VIEWS_SUBDIR = 'views';

/**
 * Resolve SSR paths from nest-cli.json for single-app and monorepo workspaces.
 */
export function resolveNestSsrProjectPaths(
  options: ResolveNestSsrProjectPathsOptions = {},
): NestSsrProjectPaths {
  const startDir = resolve(options.cwd ?? process.cwd());
  const workspaceRoot = findWorkspaceRoot(startDir);
  const nestCli = readNestCliConfig(workspaceRoot);

  const projectName = resolveProjectName(nestCli, workspaceRoot, options);
  const projectEntry = getProjectEntry(nestCli, projectName);

  const projectRoot = resolve(
    workspaceRoot,
    projectEntry.root ?? nestCli.root ?? '.',
  );
  const sourceRoot = resolve(
    workspaceRoot,
    projectEntry.sourceRoot ?? nestCli.sourceRoot ?? 'src',
  );

  const viewsDir = resolveViewsDir(
    projectRoot,
    sourceRoot,
    projectEntry,
    options.viewsDir,
  );

  const nestDistDir = resolveNestDistDir(
    workspaceRoot,
    projectName,
    projectEntry,
    nestCli,
  );
  const clientDistDir = join(nestDistDir, 'client');
  const serverDistDir = join(nestDistDir, 'server');

  const entryClientRelative = toViteUrlPath(
    relative(projectRoot, join(viewsDir, 'entry-client.tsx')),
  );
  const userEntryServer = join(viewsDir, 'entry-server.tsx');
  const entryServerDev = resolveEntryServerDevPath(
    projectRoot,
    userEntryServer,
    options.packageEntryServerPath,
  );

  const layoutProbePaths = [
    join(viewsDir, 'layout.tsx'),
    join(viewsDir, 'layout', 'index.tsx'),
    join(viewsDir, '_layout.tsx'),
  ].map((absolutePath) =>
    normalize(relative(workspaceRoot, absolutePath)).replace(/\\/g, '/'),
  );

  return {
    workspaceRoot,
    projectName,
    projectRoot,
    sourceRoot,
    viewsDir,
    viteRoot: projectRoot,
    aliasAt: sourceRoot,
    entryClientDev: entryClientRelative,
    entryServerDev,
    templateDev: join(viewsDir, 'index.html'),
    clientDistDir,
    serverDistDir,
    nestDistDir,
    layoutProbePaths,
  };
}

function findWorkspaceRoot(startDir: string): string {
  let current = startDir;
  while (true) {
    if (existsSync(join(current, 'nest-cli.json'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

function readNestCliConfig(workspaceRoot: string): NestCliConfig {
  const nestCliPath = join(workspaceRoot, 'nest-cli.json');
  if (!existsSync(nestCliPath)) {
    return {};
  }

  return readJsoncFile(nestCliPath) as NestCliConfig;
}

/**
 * Read a JSONC config file (tsconfig and nest-cli.json both allow comments
 * and trailing commas). RenderModule.forRoot() resolves paths eagerly through
 * useValue, so this runs at import time; an unguarded parse would surface a
 * bare SyntaxError with no clue which file is malformed.
 */
function readJsoncFile(path: string): unknown {
  try {
    return parseJsonc(readFileSync(path, 'utf-8'));
  } catch (error) {
    throw new Error(
      `Failed to parse ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
}

function resolveProjectName(
  nestCli: NestCliConfig,
  workspaceRoot: string,
  options: ResolveNestSsrProjectPathsOptions,
): string {
  if (options.project) {
    assertProjectExists(nestCli, options.project);
    return options.project;
  }

  const envProject = process.env.NEST_SSR_PROJECT;
  if (envProject) {
    assertProjectExists(nestCli, envProject);
    return envProject;
  }

  const applicationProjects = getApplicationProjects(nestCli);
  if (applicationProjects.length === 0) {
    return 'default';
  }

  if (applicationProjects.length === 1 && !nestCli.monorepo) {
    return applicationProjects[0].name;
  }

  const mainFilename = options.mainFilename ?? require.main?.filename;
  if (mainFilename) {
    const detected = detectProjectFromMainFile(
      mainFilename,
      workspaceRoot,
      applicationProjects,
      nestCli,
    );
    if (detected) {
      return detected;
    }
  }

  const defaultRoot = nestCli.root;
  if (defaultRoot) {
    const match = applicationProjects.find(
      (project) =>
        normalizeProjectRoot(project.entry.root ?? '.') ===
        normalizeProjectRoot(defaultRoot),
    );
    if (match) {
      return match.name;
    }
  }

  if (applicationProjects.length === 1) {
    return applicationProjects[0].name;
  }

  throw new Error(
    'Could not determine Nest SSR project in monorepo. ' +
      'Set RenderModule.forRoot({ project: "<name>" }) or NEST_SSR_PROJECT.',
  );
}

function assertProjectExists(
  nestCli: NestCliConfig,
  projectName: string,
): void {
  if (projectName === 'default') {
    return;
  }

  const projects = nestCli.projects ?? {};
  if (!projects[projectName]) {
    throw new Error(
      `Nest SSR project "${projectName}" was not found in nest-cli.json.`,
    );
  }
}

function getApplicationProjects(nestCli: NestCliConfig): Array<{
  name: string;
  entry: NestCliProjectEntry;
}> {
  const projects = nestCli.projects ?? {};
  const entries = Object.entries(projects)
    .filter(([, entry]) => entry.type === 'application' || !entry.type)
    .map(([name, entry]) => ({ name, entry }));

  if (entries.length > 0) {
    return entries;
  }

  return [
    {
      name: 'default',
      entry: {
        root: nestCli.root ?? '.',
        sourceRoot: nestCli.sourceRoot ?? 'src',
        compilerOptions: nestCli.compilerOptions,
      },
    },
  ];
}

function getProjectEntry(
  nestCli: NestCliConfig,
  projectName: string,
): NestCliProjectEntry {
  if (projectName === 'default') {
    return {
      root: nestCli.root ?? '.',
      sourceRoot: nestCli.sourceRoot ?? 'src',
      compilerOptions: nestCli.compilerOptions,
    };
  }

  const entry = nestCli.projects?.[projectName];
  if (!entry) {
    throw new Error(
      `Nest SSR project "${projectName}" was not found in nest-cli.json.`,
    );
  }

  return entry;
}

function detectProjectFromMainFile(
  mainFilename: string,
  workspaceRoot: string,
  applicationProjects: Array<{ name: string; entry: NestCliProjectEntry }>,
  nestCli: NestCliConfig,
): string | null {
  const normalizedMain = normalize(mainFilename);

  for (const { name, entry } of applicationProjects) {
    const nestDistDir = resolveNestDistDir(workspaceRoot, name, entry, nestCli);
    if (normalizedMain.startsWith(nestDistDir)) {
      return name;
    }

    const projectRoot = resolve(workspaceRoot, entry.root ?? '.');
    if (normalizedMain.startsWith(projectRoot)) {
      return name;
    }
  }

  return null;
}

function resolveViewsDir(
  projectRoot: string,
  sourceRoot: string,
  projectEntry: NestCliProjectEntry,
  override?: string,
): string {
  const configured =
    override ??
    projectEntry.ssr?.viewsDir ??
    `${relative(projectRoot, sourceRoot)}/${DEFAULT_VIEWS_SUBDIR}`;

  if (configured.startsWith('/') || /^[A-Za-z]:\\/.test(configured)) {
    return normalize(configured);
  }

  return normalize(join(projectRoot, configured));
}

function resolveNestDistDir(
  workspaceRoot: string,
  projectName: string,
  projectEntry: NestCliProjectEntry,
  nestCli: NestCliConfig,
): string {
  const tsConfigPath =
    projectEntry.compilerOptions?.tsConfigPath ??
    nestCli.compilerOptions?.tsConfigPath ??
    (projectName === 'default' ? 'tsconfig.build.json' : undefined);

  if (tsConfigPath) {
    const fullTsConfigPath = join(workspaceRoot, tsConfigPath);
    if (existsSync(fullTsConfigPath)) {
      return (
        readTsConfigOutDir(fullTsConfigPath, new Set()) ??
        normalize(join(dirname(fullTsConfigPath), 'dist'))
      );
    }
  }

  if (projectName !== 'default' && nestCli.monorepo) {
    return normalize(join(workspaceRoot, 'dist', projectName));
  }

  return normalize(join(workspaceRoot, 'dist'));
}

interface TsConfigFile {
  extends?: string | string[];
  compilerOptions?: { outDir?: string };
}

/**
 * The absolute `outDir` a tsconfig resolves to, following relative `extends`
 * the way tsc does: the config's own value wins, later `extends` entries
 * override earlier ones, and an inherited path is relative to the config that
 * declares it. Package `extends` (e.g. `@tsconfig/node22`) are not followed.
 */
function readTsConfigOutDir(
  path: string,
  seen: Set<string>,
): string | undefined {
  if (seen.has(path) || !existsSync(path)) return undefined;
  seen.add(path);

  const config = readJsoncFile(path) as TsConfigFile;
  const outDir = config.compilerOptions?.outDir;
  if (outDir) return normalize(join(dirname(path), outDir));

  const parents =
    typeof config.extends === 'string' ? [config.extends] : config.extends;
  let inherited: string | undefined;
  for (const parent of parents ?? []) {
    if (!parent.startsWith('./') && !parent.startsWith('../')) continue;
    let parentPath = join(dirname(path), parent);
    if (!existsSync(parentPath) && !parentPath.endsWith('.json')) {
      parentPath += '.json';
    }
    inherited = readTsConfigOutDir(parentPath, seen) ?? inherited;
  }
  return inherited;
}

function resolveEntryServerDevPath(
  projectRoot: string,
  userEntryServer: string,
  packageEntryServerPath?: string,
): string {
  if (existsSync(userEntryServer)) {
    return toViteUrlPath(relative(projectRoot, userEntryServer));
  }

  if (packageEntryServerPath) {
    const absolutePackagePath = normalize(packageEntryServerPath);
    const relativeToProject = relative(projectRoot, absolutePackagePath);
    if (!relativeToProject.startsWith('..')) {
      return toViteUrlPath(relativeToProject);
    }
    return absolutePackagePath.replace(/\\/g, '/');
  }

  return toViteUrlPath(relative(projectRoot, userEntryServer));
}

function toViteUrlPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function normalizeProjectRoot(root: string): string {
  return root
    .replace(/\\/g, '/')
    .replace(/^\.\/?/, '')
    .replace(/\/$/, '');
}
