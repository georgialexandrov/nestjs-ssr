#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
} from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { consola } from 'consola';
import { defineCommand, runMain } from 'citty';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  },
  async run({ args }) {
    const cwd = process.cwd();
    const viewsDir = args.views;
    const vitePort = parseInt(args.port, 10) || 5173;
    const packageJsonPath = join(cwd, 'package.json');
    const tsconfigPath = join(cwd, 'tsconfig.json');

    consola.box('@nestjs-ssr/react initialization');
    consola.start('Setting up your NestJS SSR React project...\n');

    // Validate this is a NestJS project
    if (!existsSync(packageJsonPath)) {
      consola.error('No package.json found in current directory');
      consola.info('Please run this command from your NestJS project root');
      process.exit(1);
    }

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const allDeps = {
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

      // Check for main.ts
      const mainTsPath = join(cwd, 'src/main.ts');
      if (!existsSync(mainTsPath)) {
        consola.warn('No src/main.ts file found');
        consola.info(
          'Make sure your NestJS application has a main entry point',
        );
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
    if (!existsSync(tsconfigPath)) {
      consola.error('No tsconfig.json found in project root');
      consola.info('Please create a tsconfig.json file first');
      process.exit(1);
    }

    // 1. Copy entry-client.tsx to views directory
    consola.start('Creating entry-client.tsx...');
    const entryClientSrc = join(templateDir, 'entry-client.tsx');
    const entryClientDest = join(cwd, viewsDir, 'entry-client.tsx');

    // Create views directory if it doesn't exist
    mkdirSync(join(cwd, viewsDir), { recursive: true });

    if (existsSync(entryClientDest) && !args.force) {
      consola.warn(
        `${viewsDir}/entry-client.tsx already exists (use --force to overwrite)`,
      );
    } else {
      copyFileSync(entryClientSrc, entryClientDest);
      consola.success(`Created ${viewsDir}/entry-client.tsx`);
    }

    // 2. Copy entry-server.tsx to views directory
    consola.start('Creating entry-server.tsx...');
    const entryServerSrc = join(templateDir, 'entry-server.tsx');
    const entryServerDest = join(cwd, viewsDir, 'entry-server.tsx');

    if (existsSync(entryServerDest) && !args.force) {
      consola.warn(
        `${viewsDir}/entry-server.tsx already exists (use --force to overwrite)`,
      );
    } else {
      copyFileSync(entryServerSrc, entryServerDest);
      consola.success(`Created ${viewsDir}/entry-server.tsx`);
    }

    // 3. Copy index.html template to views directory
    consola.start('Creating index.html...');
    const indexHtmlSrc = join(templateDir, 'index.html');
    const indexHtmlDest = join(cwd, viewsDir, 'index.html');

    if (existsSync(indexHtmlDest) && !args.force) {
      consola.warn(
        `${viewsDir}/index.html already exists (use --force to overwrite)`,
      );
    } else {
      copyFileSync(indexHtmlSrc, indexHtmlDest);
      consola.success(`Created ${viewsDir}/index.html`);
    }

    // 4. Update/create vite.config.ts
    consola.start('Configuring vite.config.ts...');
    const viteConfigTs = join(cwd, 'vite.config.ts');
    const viteConfigJs = join(cwd, 'vite.config.js');
    const existingConfig = existsSync(viteConfigTs) || existsSync(viteConfigJs);

    if (existingConfig) {
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
        `      input: { client: resolve(process.cwd(), '${viewsDir}/entry-client.tsx') }`,
      );
      consola.log('    }');
      consola.log('  }');
    } else {
      const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
    },
  },
  server: {
    port: ${vitePort},
    strictPort: true,
    hmr: { port: ${vitePort} },
  },
  build: {
    outDir: 'dist/client',
    manifest: true,
    rollupOptions: {
      input: {
        client: resolve(process.cwd(), '${viewsDir}/entry-client.tsx'),
      },
      // Externalize optional native dependencies that shouldn't be bundled for browser
      external: (id: string) => {
        // Externalize fsevents - an optional macOS dependency
        if (id.includes('/fsevents') || id.endsWith('fsevents')) {
          return true;
        }
        // Externalize .node native addon files
        if (id.endsWith('.node')) {
          return true;
        }
        return false;
      },
    },
  },
});
`;
      writeFileSync(viteConfigTs, viteConfig);
      consola.success('Created vite.config.ts');
    }

    // 5. Update tsconfig.json
    consola.start('Configuring tsconfig.json...');
    try {
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

      let updated = false;

      if (!tsconfig.compilerOptions) {
        tsconfig.compilerOptions = {};
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
        tsconfig.compilerOptions.paths['@/*'] = ['./src/*'];
        updated = true;
      }

      // Ensure include has .tsx files
      // Only modify include if it already exists, otherwise TypeScript
      // will automatically include all .ts and .tsx files
      if (tsconfig.include && tsconfig.include.length > 0) {
        const hasTsx = tsconfig.include.some((pattern: string) =>
          pattern.includes('**/*.tsx'),
        );
        if (!hasTsx) {
          // Add .tsx to includes if not present
          if (!tsconfig.include.includes('src/**/*.tsx')) {
            tsconfig.include.push('src/**/*.tsx');
            updated = true;
          }
        }
      }

      // Ensure exclude has entry-client.tsx
      if (!tsconfig.exclude) {
        tsconfig.exclude = [];
      }
      const hasEntryClientExclude = tsconfig.exclude.some((pattern: string) =>
        pattern.includes('entry-client.tsx'),
      );
      if (!hasEntryClientExclude) {
        tsconfig.exclude.push('src/views/entry-client.tsx');
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
    const tsconfigBuildPath = join(cwd, 'tsconfig.build.json');
    try {
      let tsconfigBuild: any;
      let buildUpdated = false;

      if (existsSync(tsconfigBuildPath)) {
        tsconfigBuild = JSON.parse(readFileSync(tsconfigBuildPath, 'utf-8'));
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

      const hasEntryClientExclude = tsconfigBuild.exclude.some(
        (pattern: string) => pattern.includes('entry-client.tsx'),
      );

      if (!hasEntryClientExclude) {
        tsconfigBuild.exclude.push('src/views/entry-client.tsx');
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
    try {
      if (existsSync(nestCliPath)) {
        const nestCli = JSON.parse(readFileSync(nestCliPath, 'utf-8'));
        let nestUpdated = false;

        if (!nestCli.exclude) {
          nestCli.exclude = [];
        }

        const hasEntryClientExclude = nestCli.exclude.some((pattern: string) =>
          pattern.includes('entry-client.tsx'),
        );

        if (!hasEntryClientExclude) {
          nestCli.exclude.push('**/entry-client.tsx');
          nestUpdated = true;
        }

        if (nestUpdated) {
          writeFileSync(nestCliPath, JSON.stringify(nestCli, null, 2));
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

    // 6. Update main.ts with enableShutdownHooks
    consola.start('Configuring main.ts...');
    const mainTsPath = join(cwd, 'src/main.ts');
    try {
      if (existsSync(mainTsPath)) {
        let mainTs = readFileSync(mainTsPath, 'utf-8');

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
            mainTs = mainTs.replace(createLine, replacement);
            writeFileSync(mainTsPath, mainTs);
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
    const appModulePath = join(cwd, 'src/app.module.ts');
    try {
      if (existsSync(appModulePath)) {
        let appModule = readFileSync(appModulePath, 'utf-8');

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
            const renderModuleConfig =
              vitePort === 5173
                ? 'RenderModule.forRoot()'
                : `RenderModule.forRoot({ vite: { port: ${vitePort} } })`;

            if (existingImports === '') {
              // Empty imports array
              appModule = appModule.replace(
                importsPattern,
                `$1${renderModuleConfig}`,
              );
            } else {
              // Has existing imports - add at the end
              appModule = appModule.replace(
                importsPattern,
                `$1$2, ${renderModuleConfig}`,
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
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      let shouldUpdate = false;

      // Add build:client script if not present
      // Includes copying index.html to dist/client for production SSR
      if (!packageJson.scripts['build:client']) {
        packageJson.scripts['build:client'] =
          `vite build --ssrManifest --outDir dist/client && cp ${viewsDir}/index.html dist/client/index.html`;
        shouldUpdate = true;
      }

      // Add build:server script if not present
      if (!packageJson.scripts['build:server']) {
        packageJson.scripts['build:server'] =
          `vite build --ssr ${viewsDir}/entry-server.tsx --outDir dist/server`;
        shouldUpdate = true;
      }

      // Add dev scripts for running Vite and NestJS
      if (!packageJson.scripts['dev:vite']) {
        packageJson.scripts['dev:vite'] = `vite --port ${vitePort}`;
        shouldUpdate = true;
      }
      if (!packageJson.scripts['dev:nest']) {
        packageJson.scripts['dev:nest'] =
          'nest start --watch --watchAssets --preserveWatchOutput';
        shouldUpdate = true;
      }
      // Update start:dev to use concurrently for better output
      if (
        !packageJson.scripts['start:dev'] ||
        !packageJson.scripts['start:dev'].includes('concurrently')
      ) {
        packageJson.scripts['start:dev'] =
          'concurrently --raw -n vite,nest -c cyan,green "pnpm:dev:vite" "pnpm:dev:nest"';
        shouldUpdate = true;
      }

      // Update main build script
      // IMPORTANT: nest build runs FIRST because it has deleteOutDir: true
      // Then vite builds run to add client and server bundles
      const existingBuild = packageJson.scripts.build;
      const recommendedBuild =
        'nest build && pnpm build:client && pnpm build:server';

      if (!existingBuild) {
        // No build script exists, create one
        packageJson.scripts.build = recommendedBuild;
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
          packageJson.scripts.build = recommendedBuild;
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
          vite: '^7.0.0',
          '@vitejs/plugin-react': '^4.0.0',
          'http-proxy-middleware': '^3.0.0',
        };

        const requiredDevDeps: Record<string, string> = {
          '@types/react': '^19.0.0',
          '@types/react-dom': '^19.0.0',
          concurrently: '^9.0.0',
        };

        const missingDeps: string[] = [];
        const missingDevDeps: string[] = [];
        const allDeps = {
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
    consola.info(`1. Create your first view component in ${viewsDir}/`);
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

runMain(main);
