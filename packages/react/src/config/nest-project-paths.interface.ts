/**
 * Resolved filesystem paths for SSR within a NestJS workspace.
 * All absolute paths are normalized; dev URL paths are Vite-root-relative.
 */
export interface NestSsrProjectPaths {
  /** Workspace root where nest-cli.json lives */
  workspaceRoot: string;
  /** Nest CLI project name */
  projectName: string;
  /** Application root directory (absolute) */
  projectRoot: string;
  /** Application source root (absolute), e.g. .../src or .../apps/web/src */
  sourceRoot: string;
  /** Views directory (absolute) */
  viewsDir: string;
  /** Vite server root (absolute) — equals projectRoot */
  viteRoot: string;
  /** Absolute path for the `@` alias (sourceRoot) */
  aliasAt: string;
  /** Dev client entry URL path, e.g. /src/views/entry-client.tsx */
  entryClientDev: string;
  /** Dev SSR entry path for vite.ssrLoadModule (leading slash) */
  entryServerDev: string;
  /** Dev HTML template (absolute) */
  templateDev: string;
  /** Production client bundle directory (absolute) */
  clientDistDir: string;
  /** Production server bundle directory (absolute) */
  serverDistDir: string;
  /** Nest backend compile output directory (absolute) */
  nestDistDir: string;
  /** Conventional layout paths relative to workspaceRoot for existence checks */
  layoutProbePaths: string[];
}

export interface ResolveNestSsrProjectPathsOptions {
  /** Explicit Nest CLI project name (monorepo) */
  project?: string;
  /** Override views directory, relative to projectRoot or absolute */
  viewsDir?: string;
  /** Starting directory for nest-cli.json discovery */
  cwd?: string;
  /** Override main entry for auto-detection (tests) */
  mainFilename?: string;
  /** Absolute path to package entry-server template fallback */
  packageEntryServerPath?: string;
}
