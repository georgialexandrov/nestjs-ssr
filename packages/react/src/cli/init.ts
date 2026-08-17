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
import { configureNestCliForSwc, getSwcRcConfig } from './swc-support.js';
import {
  buildRenderModuleConfig,
  resolveInitProjectContext,
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

const main = defineCommand({
  meta: {
    name: 'nestjs-ssr',
    description: 'Initialize @nestjs-ssr/react in your NestJS project',
    version: '0.1.6',
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
  },
  run({ args }) {
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
    const renderModuleConfig = buildRenderModuleConfig(projectName, vitePort);
    // NODE_ENV=development is required, not cosmetic: the library treats an
    // unset NODE_ENV as production (fail-closed, so a deployment that forgets
    // the variable never gets the Vite source proxy or stack-trace error
    // pages). The dev script is where that opt-in belongs.
    const nestStartCommand =
      projectName !== 'default'
        ? `NODE_ENV=development nest start ${projectName} --watch --watchAssets --preserveWatchOutput`
        : 'NODE_ENV=development nest start --watch --watchAssets --preserveWatchOutput';
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
        `      input: { client: resolve(__dirname, '${viewsDirRel}/entry-client.tsx') }`,
      );
      consola.log('    }');
      consola.log('  }');
    };

    if (existsSync(viteConfigJs)) {
      printManualViteConfig();
    } else {
      const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react({})],
  resolve: {
    alias: {
      '@': resolve(__dirname, '${sourceDirRel}'),
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
            client: resolve(__dirname, '${viewsDirRel}/entry-client.tsx'),
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
        ? `NEST_SSR_PROJECT=${projectName} concurrently --raw -n vite,nest -c cyan,green "pnpm:dev:vite" "pnpm:dev:nest"`
        : 'concurrently --raw -n vite,nest -c cyan,green "pnpm:dev:vite" "pnpm:dev:nest"';

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
      const recommendedBuild = `${nestBuildCommand} && pnpm build:client && pnpm build:server`;

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
        let packageManager = 'npm';
        if (existsSync(join(cwd, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
        else if (existsSync(join(cwd, 'yarn.lock'))) packageManager = 'yarn';

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

    consola.success('\nInitialization complete!');
    consola.box('Next steps');
    consola.info(`1. Create your first view component in ${viewsDirRel}/`);
    consola.info('2. Add a controller method with the @Render decorator:');
    consola.log('   import { Render } from "@nestjs-ssr/react";');
    consola.log('   @Get()');
    consola.log('   @Render(Home)');
    consola.log('   home() { return { message: "Hello" }; }');
    consola.info('\n3. Start development with HMR:');
    consola.log('   pnpm start:dev');
    consola.info(
      `   This runs both Vite (port ${vitePort}) and NestJS concurrently`,
    );
    consola.info('\n   Or run them separately:');
    consola.log('   Terminal 1: pnpm dev:vite');
    consola.log('   Terminal 2: pnpm dev:nest');
  },
});

void runMain(main);
