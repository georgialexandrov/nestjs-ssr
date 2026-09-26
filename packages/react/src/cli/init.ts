#!/usr/bin/env node

import {
  constants,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
} from 'fs';
import { join, resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { consola } from 'consola';
import { defineCommand, runMain } from 'citty';
import { runDev } from './dev';
import { configureNestCliForSwc, getSwcRcConfig } from './swc-support.js';
import {
  buildRenderModuleConfig,
  concurrentlyScript,
  detectPackageManager,
  resolveInitProjectContext,
  runScriptCommand,
  type InitProjectContext,
} from './init-project-context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Scaffold a file, refusing to clobber an existing one unless `force`.
 *
 * The exclusive flag makes "does it exist?" and "write it" a single syscall.
 * An `existsSync` check followed by a separate write leaves a window in which
 * the path can be created — or swapped for a symlink pointing somewhere else —
 * between the two calls, so the write lands on a file the check never saw.
 * Returns false when the file was already there and was left untouched.
 */
function writeFileIfAbsent(
  path: string,
  content: string,
  force = false,
): boolean {
  try {
    writeFileSync(path, content, { flag: force ? 'w' : 'wx' });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return false;
    }
    throw error;
  }
}

/**
 * Read a UTF-8 file, returning null when it does not exist.
 *
 * The counterpart to writeFileIfAbsent for read-modify-write updates: one
 * syscall instead of an `existsSync` guard followed by a read, so the file
 * cannot appear or vanish in between and the read always reflects what the
 * caller goes on to modify.
 */
/** Whether a package.json declares an ES module package. */
function isEsmPackageJson(raw: string): boolean {
  try {
    return (JSON.parse(raw) as { type?: unknown }).type === 'module';
  } catch {
    return false;
  }
}

function readFileIfExists(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Copy a template file, refusing to clobber an existing one unless `force`.
 * COPYFILE_EXCL gives the same single-syscall guarantee as writeFileIfAbsent.
 */
function copyFileIfAbsent(src: string, dest: string, force = false): boolean {
  try {
    copyFileSync(src, dest, force ? 0 : constants.COPYFILE_EXCL);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return false;
    }
    throw error;
  }
}

/**
 * Add a controller to the root module's `controllers` array. Returns false
 * when the module does not have the shape `nest new` generates.
 */
function registerController(
  appModulePath: string,
  name: string,
  from: string,
): boolean {
  const source = readFileIfExists(appModulePath);
  if (source === null) return false;
  if (source.includes(name)) return true;
  const controllers = /(controllers:\s*\[)([^\]]*)(\])/;
  const match = controllers.exec(source);
  if (!match) return false;
  const existing = match[2].trim();
  let updated = source.replace(
    controllers,
    `$1${existing ? `${existing}, ${name}` : name}$3`,
  );
  const lastImport = [...updated.matchAll(/^import .*;$/gm)].pop();
  const statement = `import { ${name} } from '${from}';`;
  updated = lastImport
    ? updated.slice(0, lastImport.index + lastImport[0].length) +
      `\n${statement}` +
      updated.slice(lastImport.index + lastImport[0].length)
    : `${statement}\n${updated}`;
  writeFileSync(appModulePath, updated);
  return true;
}

/** This package's version, for `--version`. */
function packageVersion(): string {
  for (const candidate of ['../../package.json', '../package.json']) {
    try {
      const pkg = JSON.parse(
        readFileSync(join(__dirname, candidate), 'utf-8'),
      ) as { name?: string; version?: string };
      if (pkg.name === '@nestjs-ssr/react' && pkg.version) return pkg.version;
    } catch {
      // try the next location
    }
  }
  return 'unknown';
}

const main = defineCommand({
  meta: {
    name: 'nestjs-ssr',
    description: 'Initialize @nestjs-ssr/react in your NestJS project',
    version: packageVersion(),
  },
  args: {
    force: {
      type: 'boolean',
      description: 'Overwrite existing files',
      alias: 'f',
    },
    views: {
      type: 'string',
      description: 'Views directory path',
      default: 'src/views',
    },
    'skip-install': {
      type: 'boolean',
      description: 'Skip automatic dependency installation',
      default: false,
    },
    port: {
      type: 'string',
      description: 'Vite dev server port',
      default: '5173',
    },
    project: {
      type: 'string',
      description: 'Nest CLI project name (required for monorepos)',
    },
    mode: {
      type: 'string',
      description: 'SSR mode: string (default) or stream',
    },
    pm: {
      type: 'string',
      description:
        'Package manager for installs and scripts: pnpm, npm, yarn or bun (detected when omitted)',
    },
    examples: {
      type: 'boolean',
      description:
        'Create a starter layout and /welcome page (--no-examples to skip)',
      default: true,
    },
    yes: {
      type: 'boolean',
      description: 'Accept defaults without prompting (implied when not a TTY)',
      alias: 'y',
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const vitePort = parseInt(args.port, 10) || 5173;
    const packageJsonPath = join(cwd, 'package.json');

    let initContext: InitProjectContext;
    try {
      initContext = resolveInitProjectContext({
        cwd,
        project: args.project,
        viewsDir: args.views,
      });
    } catch (error) {
      consola.error((error as Error).message);
      process.exit(1);
    }

    const {
      projectName,
      projectRoot,
      sourceRoot,
      viewsDirAbs,
      viewsDirRel,
      tsconfigPath,
      tsconfigBuildPath,
      viteConfigPath,
      clientOutDirRel,
      serverOutDirRel,
      isMonorepo,
    } = initContext;
    const viteConfigRel = relative(cwd, viteConfigPath).replace(/\\/g, '/');
    const sourceDirRel = relative(projectRoot, sourceRoot).replace(/\\/g, '/');
    const packageManager = detectPackageManager(cwd, args.pm);
    const run = (script: string) => runScriptCommand(packageManager, script);
    const interactive = !args.yes && Boolean(process.stdin.isTTY);
    let ssrMode: 'string' | 'stream' =
      args.mode === 'stream' ? 'stream' : 'string';
    if (interactive && !args.mode) {
      const answer = await consola.prompt('How should pages be rendered?', {
        type: 'select',
        options: [
          {
            value: 'string',
            label: 'String',
            hint: 'renderToString: simplest, one complete response',
          },
          {
            value: 'stream',
            label: 'Stream',
            hint: 'renderToPipeableStream: faster first byte, Suspense',
          },
        ],
        initial: 'string',
        cancel: 'default',
      });
      ssrMode = answer === 'stream' ? 'stream' : 'string';
    }
    const withExamples = args.examples !== false;
    const renderModuleConfig = buildRenderModuleConfig(
      projectName,
      vitePort,
      ssrMode,
      // The starter layout reads its theme from this cookie on the server.
      withExamples ? ['theme'] : [],
    );
    // NODE_ENV=development is required, not cosmetic: the library treats an
    // unset NODE_ENV as production (fail-closed, so a deployment that forgets
    // the variable never gets the Vite source proxy or stack-trace error
    // pages). The dev script is where that opt-in belongs.
    const nestStartCommand =
      projectName !== 'default'
        ? `NODE_ENV=development nest start ${projectName} --watch --watchAssets --preserveWatchOutput`
        : // `nestjs-ssr dev` compiles like `nest start --watch` but does not
          // restart Nest when only views change; they update through Vite.
          'NODE_ENV=development nestjs-ssr dev --watchAssets';
    const nestBuildCommand =
      projectName !== 'default' ? `nest build ${projectName}` : 'nest build';

    consola.box('@nestjs-ssr/react initialization');
    consola.start('Setting up your NestJS SSR React project...\n');

    // Validate this is a NestJS project
    const packageJsonRaw = readFileIfExists(packageJsonPath);
    if (packageJsonRaw === null) {
      consola.error('No package.json found in current directory');
      consola.info('Please run this command from your NestJS project root');
      process.exit(1);
    }

    // Nest 12's `nest new` creates ES module projects ("type": "module").
    // Generated config must not rely on CommonJS globals there: `__dirname`
    // is unsupported by Vite's native config loader in ESM. CommonJS projects
    // (Nest 11 and earlier) keep exactly the output they always got.
    const isEsmProject = isEsmPackageJson(packageJsonRaw);
    const configDirExpr = isEsmProject ? 'import.meta.dirname' : '__dirname';

    try {
      const packageJson = JSON.parse(packageJsonRaw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const allDeps: Record<string, string> = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      const requiredNestDeps = ['@nestjs/core', '@nestjs/common'];
      const missingNestDeps = requiredNestDeps.filter((dep) => !allDeps[dep]);

      if (missingNestDeps.length > 0) {
        consola.error(
          'This does not appear to be a NestJS project. Missing packages:',
        );
        consola.info(`  ${missingNestDeps.join(', ')}`);
        consola.info('\nPlease install NestJS first:');
        consola.info(
          '  npm install @nestjs/core @nestjs/common @nestjs/platform-express',
        );
        consola.info('\nOr create a new NestJS project:');
        consola.info('  npm i -g @nestjs/cli');
        consola.info('  nest new my-project');
        process.exit(1);
      }
    } catch (error) {
      consola.error('Failed to validate package.json:', error);
      process.exit(1);
    }

    // Find template files - check both src/ (dev) and dist/ (production) locations
    const templateLocations = [
      resolve(__dirname, '../../src/templates'), // Development (ts-node/tsx)
      resolve(__dirname, '../templates'), // Built package (dist/cli -> dist/templates)
    ];
    const templateDir = templateLocations.find((loc) =>
      existsSync(join(loc, 'entry-client.tsx')),
    );

    if (!templateDir) {
      consola.error('Failed to locate template files');
      consola.info('Searched:', templateLocations);
      process.exit(1);
    }

    // Check that tsconfig.json exists - we don't create it
    const tsconfigRaw = readFileIfExists(tsconfigPath);
    if (tsconfigRaw === null) {
      consola.error('No tsconfig.json found in project root');
      consola.info('Please create a tsconfig.json file first');
      process.exit(1);
    }

    // 1. Copy entry-client.tsx to views directory
    consola.start('Creating entry-client.tsx...');
    const entryClientSrc = join(templateDir, 'entry-client.tsx');
    const entryClientDest = join(viewsDirAbs, 'entry-client.tsx');

    // Create views directory if it doesn't exist
    mkdirSync(viewsDirAbs, { recursive: true });

    if (copyFileIfAbsent(entryClientSrc, entryClientDest, args.force)) {
      consola.success(`Created ${viewsDirRel}/entry-client.tsx`);
    } else {
      consola.warn(
        `${viewsDirRel}/entry-client.tsx already exists (use --force to overwrite)`,
      );
    }

    // 2. Copy entry-server.tsx to views directory
    consola.start('Creating entry-server.tsx...');
    const entryServerSrc = join(templateDir, 'entry-server.tsx');
    const entryServerDest = join(viewsDirAbs, 'entry-server.tsx');

    if (copyFileIfAbsent(entryServerSrc, entryServerDest, args.force)) {
      consola.success(`Created ${viewsDirRel}/entry-server.tsx`);
    } else {
      consola.warn(
        `${viewsDirRel}/entry-server.tsx already exists (use --force to overwrite)`,
      );
    }

    // 3. Copy index.html template to views directory
    consola.start('Creating index.html...');
    const indexHtmlSrc = join(templateDir, 'index.html');
    const indexHtmlDest = join(viewsDirAbs, 'index.html');

    if (copyFileIfAbsent(indexHtmlSrc, indexHtmlDest, args.force)) {
      consola.success(`Created ${viewsDirRel}/index.html`);
    } else {
      consola.warn(
        `${viewsDirRel}/index.html already exists (use --force to overwrite)`,
      );
    }

    // 3b. Starter layout and welcome page
    let welcomeControllerCreated = false;
    if (withExamples) {
      const starterDir = join(templateDir, 'starter');
      for (const file of ['layout.tsx', 'welcome.tsx']) {
        const dest = join(viewsDirAbs, file);
        if (copyFileIfAbsent(join(starterDir, file), dest, false)) {
          consola.success(`Created ${viewsDirRel}/${file}`);
        }
      }
      const controllerDest = join(sourceRoot, 'welcome.controller.ts');
      const viewsImport = `./${relative(sourceRoot, join(viewsDirAbs, 'welcome')).replace(/\\/g, '/')}${isEsmProject ? '.js' : ''}`;
      const controllerSource = readFileSync(
        join(starterDir, 'welcome.controller.ts'),
        'utf-8',
      ).replace("from './views/welcome'", `from '${viewsImport}'`);
      if (writeFileIfAbsent(controllerDest, controllerSource)) {
        welcomeControllerCreated = true;
        consola.success(
          `Created ${relative(cwd, controllerDest).replace(/\\/g, '/')}`,
        );
      }
    }

    // 4. Update/create vite.config.ts
    consola.start('Configuring vite.config.ts...');
    // A .js config is a different path from the .ts one we would write, so it
    // still needs its own probe; the .ts path is not checked here — the
    // exclusive write below reports whether it already existed.
    const viteConfigJs = join(projectRoot, 'vite.config.js');
    const printManualViteConfig = () => {
      consola.warn('vite.config already exists');
      consola.info('Please manually add to your Vite config:');
      consola.log("  import { resolve } from 'path';");
      consola.log('  server: {');
      consola.log(`    port: ${vitePort},`);
      consola.log('    strictPort: true,');
      consola.log(`    hmr: { port: ${vitePort} },`);
      consola.log('  },');
      consola.log('  build: {');
      consola.log('    rollupOptions: {');
      consola.log(
        `      input: { client: resolve(${configDirExpr}, '${viewsDirRel}/entry-client.tsx') }`,
      );
      consola.log('    }');
      consola.log('  }');
    };

    if (existsSync(viteConfigJs)) {
      printManualViteConfig();
    } else {
      const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nestjsSsr } from '@nestjs-ssr/react/vite';
import { resolve } from 'path';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react({}), nestjsSsr()],
  resolve: {
    alias: {
      '@': resolve(${configDirExpr}, '${sourceDirRel}'),
    },
    dedupe: ['react', 'react-dom', '@nestjs-ssr/react'],
  },
  ssr: {
    noExternal: ['@nestjs-ssr/react'],
  },
  server: {
    port: ${vitePort},
    strictPort: true,
    hmr: { port: ${vitePort} },
  },
  build: {
    outDir: isSsrBuild ? '${serverOutDirRel}' : '${clientOutDirRel}',
    manifest: true,
    rollupOptions: {
      input: !isSsrBuild
        ? {
            client: resolve(${configDirExpr}, '${viewsDirRel}/entry-client.tsx'),
          }
        : undefined,
      external: (id: string) => {
        if (id.includes('/fsevents') || id.endsWith('fsevents')) {
          return true;
        }
        if (id.endsWith('.node')) {
          return true;
        }
        return false;
      },
    },
  },
}));
`;
      if (writeFileIfAbsent(viteConfigPath, viteConfig)) {
        consola.success(`Created ${relative(cwd, viteConfigPath)}`);
      } else {
        printManualViteConfig();
      }
    }

    // 5. Update tsconfig.json
    consola.start('Configuring tsconfig.json...');
    try {
      interface TsConfig {
        compilerOptions?: {
          module?: string;
          moduleResolution?: string;
          jsx?: string;
          paths?: Record<string, string[]>;
        };
        include?: string[];
        exclude?: string[];
      }
      const tsconfig = JSON.parse(tsconfigRaw) as TsConfig;

      let updated = false;

      if (!tsconfig.compilerOptions) {
        tsconfig.compilerOptions = {};
      }

      // Ensure module resolution is set for Vite 8+ compatibility
      if (
        tsconfig.compilerOptions.module !== 'nodenext' &&
        tsconfig.compilerOptions.moduleResolution !== 'bundler'
      ) {
        tsconfig.compilerOptions.module = 'nodenext';
        tsconfig.compilerOptions.moduleResolution = 'nodenext';
        updated = true;
      }

      // Ensure jsx is set
      if (tsconfig.compilerOptions.jsx !== 'react-jsx') {
        tsconfig.compilerOptions.jsx = 'react-jsx';
        updated = true;
      }

      // Ensure paths includes @ alias
      if (!tsconfig.compilerOptions.paths) {
        tsconfig.compilerOptions.paths = {};
      }
      if (!tsconfig.compilerOptions.paths['@/*']) {
        const aliasPath = `./${relative(dirname(tsconfigPath), sourceRoot).replace(/\\/g, '/')}/*`;
        tsconfig.compilerOptions.paths['@/*'] = [aliasPath];
        updated = true;
      }

      // Ensure include has .tsx files
      // Only modify include if it already exists, otherwise TypeScript
      // will automatically include all .ts and .tsx files
      if (tsconfig.include && tsconfig.include.length > 0) {
        const hasTsx = tsconfig.include.some((pattern) =>
          pattern.includes('**/*.tsx'),
        );
        if (!hasTsx) {
          // Add .tsx to includes if not present
          if (!tsconfig.include.includes(`${sourceDirRel}/**/*.tsx`)) {
            tsconfig.include.push(`${sourceDirRel}/**/*.tsx`);
            updated = true;
          }
        }
      }

      // Ensure exclude has entry-client.tsx
      if (!tsconfig.exclude) {
        tsconfig.exclude = [];
      }
      const hasEntryClientExclude = tsconfig.exclude.some((pattern) =>
        pattern.includes('entry-client.tsx'),
      );
      if (!hasEntryClientExclude) {
        tsconfig.exclude.push(`${viewsDirRel}/entry-client.tsx`);
        updated = true;
      }

      if (updated) {
        writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
        consola.success('Updated tsconfig.json');
      } else {
        consola.info('tsconfig.json already configured');
      }
    } catch (error) {
      consola.error('Failed to update tsconfig.json:', error);
    }

    // 5.5. Update/create tsconfig.build.json
    consola.start('Configuring tsconfig.build.json...');
    try {
      interface TsConfigBuild {
        extends?: string;
        exclude?: string[];
      }
      let tsconfigBuild: TsConfigBuild;
      let buildUpdated = false;

      const tsconfigBuildRaw = readFileIfExists(tsconfigBuildPath);
      if (tsconfigBuildRaw !== null) {
        tsconfigBuild = JSON.parse(tsconfigBuildRaw) as TsConfigBuild;
      } else {
        tsconfigBuild = {
          extends: './tsconfig.json',
          exclude: ['node_modules', 'test', 'dist', '**/*spec.ts'],
        };
        buildUpdated = true;
      }

      if (!tsconfigBuild.exclude) {
        tsconfigBuild.exclude = [];
      }

      const hasEntryClientExclude = tsconfigBuild.exclude.some((pattern) =>
        pattern.includes('entry-client.tsx'),
      );

      if (!hasEntryClientExclude) {
        tsconfigBuild.exclude.push(`${viewsDirRel}/entry-client.tsx`);
        buildUpdated = true;
      }

      if (buildUpdated) {
        writeFileSync(
          tsconfigBuildPath,
          JSON.stringify(tsconfigBuild, null, 2),
        );
        consola.success('Updated tsconfig.build.json');
      } else {
        consola.info('tsconfig.build.json already configured');
      }
    } catch (error) {
      consola.error('Failed to update tsconfig.build.json:', error);
    }

    // 5.6. Update nest-cli.json
    consola.start('Configuring nest-cli.json...');
    const nestCliPath = join(cwd, 'nest-cli.json');
    let usesSwc = false;
    try {
      const nestCliRaw = readFileIfExists(nestCliPath);
      if (nestCliRaw !== null) {
        const nestCli = JSON.parse(nestCliRaw) as {
          exclude?: string[];
          [key: string]: unknown;
        };
        let nestUpdated = false;

        if (!nestCli.exclude) {
          nestCli.exclude = [];
        }

        const hasEntryClientExclude = nestCli.exclude.some((pattern) =>
          pattern.includes('entry-client.tsx'),
        );

        if (!hasEntryClientExclude) {
          nestCli.exclude.push('**/entry-client.tsx');
          nestUpdated = true;
        }

        // Detect SWC builder and add .tsx extension support
        const swcResult = configureNestCliForSwc(nestCli);
        usesSwc = swcResult.usesSwc;

        const configToWrite = swcResult.updatedNestCli ?? nestCli;
        if (swcResult.updatedNestCli) {
          nestUpdated = true;
        }

        if (nestUpdated) {
          writeFileSync(nestCliPath, JSON.stringify(configToWrite, null, 2));
          consola.success('Updated nest-cli.json');
        } else {
          consola.info('nest-cli.json already configured');
        }
      } else {
        consola.info('No nest-cli.json found, skipping');
      }
    } catch (error) {
      consola.error('Failed to update nest-cli.json:', error);
    }

    // 5.7. Create .swcrc for SWC users (enables .tsx compilation)
    if (usesSwc) {
      consola.start('Configuring .swcrc for SWC...');
      const swcrcPath = join(cwd, '.swcrc');
      const swcrcWritten = writeFileIfAbsent(
        swcrcPath,
        JSON.stringify(getSwcRcConfig(), null, 2) + '\n',
        args.force,
      );
      if (swcrcWritten) {
        consola.success('Created .swcrc with TSX support');
      } else {
        consola.warn('.swcrc already exists (use --force to overwrite)');
      }
    }

    // 6. Update main.ts with enableShutdownHooks
    consola.start('Configuring main.ts...');
    const mainTsPath = join(sourceRoot, 'main.ts');
    try {
      const mainTs = readFileIfExists(mainTsPath);
      if (mainTs === null) {
        consola.warn('No src/main.ts file found');
        consola.info(
          'Make sure your NestJS application has a main entry point',
        );
      } else {
        if (mainTs.includes('enableShutdownHooks')) {
          consola.info('main.ts already has enableShutdownHooks()');
        } else {
          // Find the NestFactory.create line and add enableShutdownHooks after it
          // Match patterns like:
          // const app = await NestFactory.create(AppModule);
          // const app = await NestFactory.create<NestExpressApplication>(AppModule);
          const createPattern =
            /(const\s+app\s*=\s*await\s+NestFactory\.create[^;]+;)/;
          const match = mainTs.match(createPattern);

          if (match) {
            const createLine = match[1];
            const replacement = `${createLine}\n\n  // Enable graceful shutdown for proper Vite cleanup\n  app.enableShutdownHooks();`;
            writeFileSync(mainTsPath, mainTs.replace(createLine, replacement));
            consola.success('Added enableShutdownHooks() to main.ts');
          } else {
            consola.warn(
              'Could not find NestFactory.create in main.ts, please add manually:',
            );
            consola.log('  app.enableShutdownHooks();');
          }
        }
      }
    } catch (error) {
      consola.warn('Failed to update main.ts:', error);
      consola.info(
        'Please manually add to your main.ts after NestFactory.create():',
      );
      consola.log('  app.enableShutdownHooks();');
    }

    // 6.5. Register RenderModule in app.module.ts
    consola.start('Configuring app.module.ts...');
    const appModulePath = join(sourceRoot, 'app.module.ts');
    try {
      let appModule = readFileIfExists(appModulePath);
      if (appModule !== null) {
        if (appModule.includes('RenderModule')) {
          consola.info('app.module.ts already has RenderModule');
        } else {
          let updated = false;

          // Add import statement after other @nestjs imports or at the top
          const importStatement =
            "import { RenderModule } from '@nestjs-ssr/react';";

          if (!appModule.includes(importStatement)) {
            // Find the last @nestjs import or any import to add after
            const nestImportPattern =
              /(import\s+.*from\s+['"]@nestjs\/[^'"]+['"];?\n)/g;
            const matches = [...appModule.matchAll(nestImportPattern)];

            if (matches.length > 0) {
              // Add after the last @nestjs import
              const lastMatch = matches[matches.length - 1];
              const insertPos = lastMatch.index + lastMatch[0].length;
              appModule =
                appModule.slice(0, insertPos) +
                importStatement +
                '\n' +
                appModule.slice(insertPos);
              updated = true;
            } else {
              // No @nestjs imports found, add at the top after any existing imports
              const anyImportPattern =
                /(import\s+.*from\s+['"][^'"]+['"];?\n)/g;
              const anyMatches = [...appModule.matchAll(anyImportPattern)];

              if (anyMatches.length > 0) {
                const lastMatch = anyMatches[anyMatches.length - 1];
                const insertPos = lastMatch.index + lastMatch[0].length;
                appModule =
                  appModule.slice(0, insertPos) +
                  importStatement +
                  '\n' +
                  appModule.slice(insertPos);
                updated = true;
              }
            }
          }

          // Add RenderModule.forRoot() to imports array
          // Match imports: [] or imports: [SomeModule, ...]
          const importsPattern = /(imports:\s*\[)([^\]]*)/;
          const importsMatch = appModule.match(importsPattern);

          if (importsMatch) {
            const existingImports = importsMatch[2].trim();
            // Simple config - port defaults to 5173
            const renderModuleConfigLine = renderModuleConfig;

            if (existingImports === '') {
              // Empty imports array
              appModule = appModule.replace(
                importsPattern,
                `$1${renderModuleConfigLine}`,
              );
            } else {
              // Has existing imports - add at the end
              appModule = appModule.replace(
                importsPattern,
                `$1$2, ${renderModuleConfigLine}`,
              );
            }
            updated = true;
          }

          if (updated) {
            writeFileSync(appModulePath, appModule);
            consola.success('Added RenderModule to app.module.ts');
          } else {
            consola.warn(
              'Could not automatically update app.module.ts, please add manually:',
            );
            consola.log(`  import { RenderModule } from '@nestjs-ssr/react';`);
            consola.log('  // In @Module imports:');
            consola.log('  RenderModule.forRoot()');
          }
        }
      } else {
        consola.warn('No src/app.module.ts found');
        consola.info('Please manually add RenderModule to your app module');
      }
    } catch (error) {
      consola.warn('Failed to update app.module.ts:', error);
      consola.info('Please manually add to your app.module.ts:');
      consola.log(`  import { RenderModule } from '@nestjs-ssr/react';`);
      consola.log('  // In @Module imports:');
      consola.log('  RenderModule.forRoot()');
    }

    // 6.6. Register the starter's WelcomeController
    if (welcomeControllerCreated) {
      const registered = registerController(
        appModulePath,
        'WelcomeController',
        `./welcome.controller${isEsmProject ? '.js' : ''}`,
      );
      if (!registered) {
        consola.warn(
          'Add WelcomeController to the controllers of your app module to serve /welcome',
        );
      }
    }

    // 7. Setup build scripts
    consola.start('Configuring build scripts...');

    try {
      interface PackageJson {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      }
      const packageJson = JSON.parse(
        readFileSync(packageJsonPath, 'utf-8'),
      ) as PackageJson;

      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      let shouldUpdate = false;

      const buildClientScript = `vite build --config ${viteConfigRel} --ssrManifest --outDir ${clientOutDirRel} && cp ${viewsDirRel}/index.html ${clientOutDirRel}/index.html`;
      const buildServerScript = `vite build --config ${viteConfigRel} --ssr ${viewsDirRel}/entry-server.tsx --outDir ${serverOutDirRel}`;
      const devViteScript = `vite --config ${viteConfigRel} --port ${vitePort}`;
      const startDevScript = isMonorepo
        ? `NEST_SSR_PROJECT=${projectName} concurrently --raw -n vite,nest -c cyan,green ${concurrentlyScript(packageManager, 'dev:vite')} ${concurrentlyScript(packageManager, 'dev:nest')}`
        : `concurrently --raw -n vite,nest -c cyan,green ${concurrentlyScript(packageManager, 'dev:vite')} ${concurrentlyScript(packageManager, 'dev:nest')}`;

      // Add build:client script if not present
      // Includes copying index.html to dist/client for production SSR
      if (!packageJson.scripts['build:client']) {
        packageJson.scripts['build:client'] = buildClientScript;
        shouldUpdate = true;
      }

      // Add build:server script if not present
      if (!packageJson.scripts['build:server']) {
        packageJson.scripts['build:server'] = buildServerScript;
        shouldUpdate = true;
      }

      // Add dev scripts for running Vite and NestJS
      if (!packageJson.scripts['dev:vite']) {
        packageJson.scripts['dev:vite'] = devViteScript;
        shouldUpdate = true;
      }
      if (!packageJson.scripts['dev:nest']) {
        packageJson.scripts['dev:nest'] = nestStartCommand;
        shouldUpdate = true;
      }
      // Update start:dev to use concurrently for better output
      if (
        !packageJson.scripts['start:dev'] ||
        !packageJson.scripts['start:dev'].includes('concurrently')
      ) {
        packageJson.scripts['start:dev'] = startDevScript;
        shouldUpdate = true;
      }

      // Update main build script
      // IMPORTANT: nest build runs FIRST because it has deleteOutDir: true
      // Then vite builds run to add client and server bundles
      const existingBuild = packageJson.scripts['build'];
      const recommendedBuild = `${nestBuildCommand} && ${run('build:client')} && ${run('build:server')}`;

      if (!existingBuild) {
        // No build script exists, create one
        packageJson.scripts['build'] = recommendedBuild;
        shouldUpdate = true;
        consola.success('Created build script');
      } else if (existingBuild !== recommendedBuild) {
        // Build script exists but is different from recommended
        if (
          !existingBuild.includes('build:client') ||
          !existingBuild.includes('build:server')
        ) {
          consola.warn(`Found existing build script: "${existingBuild}"`);
          consola.info(`Updating to: ${recommendedBuild}`);
          packageJson.scripts['build'] = recommendedBuild;
          shouldUpdate = true;
        } else {
          consola.info('Build scripts already configured');
        }
      } else {
        consola.info('Build scripts already configured');
      }

      if (shouldUpdate) {
        writeFileSync(
          packageJsonPath,
          JSON.stringify(packageJson, null, 2) + '\n',
        );
        consola.success('Updated build scripts in package.json');
      }

      // 7. Check and install dependencies
      if (!args['skip-install']) {
        consola.start('Checking dependencies...');
        const requiredDeps: Record<string, string> = {
          '@nestjs-ssr/react': 'latest',
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          // Keep these two in step. @vitejs/plugin-react 4 predates Vite 7, and
          // that pairing breaks Vite's dependency optimizer with
          // "require_react is not a function", which kills hydration outright.
          // Pinned to the pair the library is tested against.
          vite: '8.2.1',
          '@vitejs/plugin-react': '6.0.5',
          'http-proxy-middleware': '^4.2.0',
        };

        const requiredDevDeps: Record<string, string> = {
          '@types/react': '^19.0.0',
          '@types/react-dom': '^19.0.0',
          concurrently: '^9.0.0',
        };

        const missingDeps: string[] = [];
        const missingDevDeps: string[] = [];
        const allDeps: Record<string, string> = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        for (const [dep, version] of Object.entries(requiredDeps)) {
          if (!allDeps[dep]) {
            missingDeps.push(`${dep}@${version}`);
          }
        }

        for (const [dep, version] of Object.entries(requiredDevDeps)) {
          if (!allDeps[dep]) {
            missingDevDeps.push(`${dep}@${version}`);
          }
        }

        // Detect package manager

        if (missingDeps.length > 0) {
          consola.info(`Missing dependencies: ${missingDeps.join(', ')}`);

          const installCmd =
            packageManager === 'npm'
              ? `npm install ${missingDeps.join(' ')}`
              : `${packageManager} add ${missingDeps.join(' ')}`;

          try {
            consola.start(`Installing dependencies with ${packageManager}...`);
            execSync(installCmd, {
              cwd,
              stdio: 'inherit',
            });
            consola.success('Dependencies installed!');
          } catch (error) {
            consola.error('Failed to install dependencies:', error);
            consola.info(`Please manually run: ${installCmd}`);
          }
        }

        if (missingDevDeps.length > 0) {
          consola.info(
            `Missing dev dependencies: ${missingDevDeps.join(', ')}`,
          );

          const installDevCmd =
            packageManager === 'npm'
              ? `npm install -D ${missingDevDeps.join(' ')}`
              : `${packageManager} add -D ${missingDevDeps.join(' ')}`;

          try {
            consola.start(
              `Installing dev dependencies with ${packageManager}...`,
            );
            execSync(installDevCmd, {
              cwd,
              stdio: 'inherit',
            });
            consola.success('Dev dependencies installed!');
          } catch (error) {
            consola.error('Failed to install dev dependencies:', error);
            consola.info(`Please manually run: ${installDevCmd}`);
          }
        }

        if (missingDeps.length === 0 && missingDevDeps.length === 0) {
          consola.success('All required dependencies are already installed');
        }
      }
    } catch (error) {
      consola.error('Failed to update package.json:', error);
    }

    consola.success('Initialization complete!');
    consola.box(
      [
        'Next steps',
        '',
        `  ${run('start:dev')}`,
        `  Starts Vite (port ${vitePort}) and NestJS; open http://localhost:3000${withExamples ? '/welcome' : ''}`,
        '',
        `  Pages live in ${viewsDirRel}/. Render one from a controller:`,
        '',
        "    import { Render } from '@nestjs-ssr/react';",
        '    @Get() @Render(Home)',
        "    home() { return { message: 'Hello' }; }",
        '',
        `  Production: ${run('build')} && ${run('start:prod')}`,
        '  Docs: https://georgialexandrov.github.io/nestjs-ssr/',
      ].join('\n'),
    );
  },
});

// `nestjs-ssr dev` runs the development server loop. `init` takes no
// positional arguments, so `dev` cannot collide with an existing invocation.
if (process.argv[2] === 'dev') {
  runDev({
    cwd: process.cwd(),
    buildArgs: process.argv.slice(3),
    log: (message) => consola.info(message),
  });
} else {
  void runMain(main);
}
