#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
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
  },
  async run({ args }) {
    const cwd = process.cwd();
    const viewsDir = args.views;

    consola.box('@nestjs-ssr/react initialization');
    consola.start('Setting up your NestJS SSR React project...\n');

    // Find template files - check both src/ (dev) and dist/ (production) locations
    const templateLocations = [
      resolve(__dirname, '../../src/templates'),  // Development (ts-node/tsx)
      resolve(__dirname, '../templates'),         // Built package (dist/cli -> dist/templates)
    ];
    const templateDir = templateLocations.find(loc => existsSync(join(loc, 'entry-client.tsx')));

    if (!templateDir) {
      consola.error('Failed to locate template files');
      consola.info('Searched:', templateLocations);
      process.exit(1);
    }

    // Global types are provided by the package via @nestjs-ssr/react/global export
    // No need to locate or copy global.d.ts

    // Check that tsconfig.json exists - we don't create it
    const tsconfigPath = join(cwd, 'tsconfig.json');
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
      consola.warn(`${viewsDir}/entry-client.tsx already exists (use --force to overwrite)`);
    } else {
      copyFileSync(entryClientSrc, entryClientDest);
      consola.success(`Created ${viewsDir}/entry-client.tsx`);
    }

    // 2. Copy entry-server.tsx to views directory
    consola.start('Creating entry-server.tsx...');
    const entryServerSrc = join(templateDir, 'entry-server.tsx');
    const entryServerDest = join(cwd, viewsDir, 'entry-server.tsx');

    if (existsSync(entryServerDest) && !args.force) {
      consola.warn(`${viewsDir}/entry-server.tsx already exists (use --force to overwrite)`);
    } else {
      copyFileSync(entryServerSrc, entryServerDest);
      consola.success(`Created ${viewsDir}/entry-server.tsx`);
    }

    // Global types are now referenced from the package via @nestjs-ssr/react/global
    // No need to copy global.d.ts to the project

    // 4. Update/create vite.config.js
    consola.start('Configuring vite.config.js...');
    const viteConfigPath = join(cwd, 'vite.config.js');
    const viteConfigTs = join(cwd, 'vite.config.ts');
    const useTypeScript = existsSync(viteConfigTs);
    const configPath = useTypeScript ? viteConfigTs : viteConfigPath;

    if (existsSync(configPath)) {
      consola.warn(`${useTypeScript ? 'vite.config.ts' : 'vite.config.js'} already exists`);
      consola.info('Please manually add to your Vite config:');
      consola.log('  import { resolve } from \'path\';');
      consola.log('  build: {');
      consola.log('    rollupOptions: {');
      consola.log(`      input: { client: resolve(__dirname, '${viewsDir}/entry-client.tsx') }`);
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
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
  build: {
    outDir: 'dist/client',
    manifest: true,
    rollupOptions: {
      input: {
        client: resolve(__dirname, '${viewsDir}/entry-client.tsx'),
      },
    },
  },
});
`;
      writeFileSync(viteConfigPath, viteConfig);
      consola.success('Created vite.config.js');
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
      if (!tsconfig.include) {
        tsconfig.include = [];
      }
      const hasTsx = tsconfig.include.some((pattern: string) => pattern.includes('**/*.tsx'));
      if (!hasTsx) {
        // Add .tsx to includes if not present
        if (!tsconfig.include.includes('src/**/*.tsx')) {
          tsconfig.include.push('src/**/*.tsx');
          updated = true;
        }
      }

      // Ensure exclude has entry-client.tsx
      if (!tsconfig.exclude) {
        tsconfig.exclude = [];
      }
      const hasEntryClientExclude = tsconfig.exclude.some((pattern: string) =>
        pattern.includes('entry-client.tsx')
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
          exclude: ['node_modules', 'test', 'dist', '**/*spec.ts']
        };
        buildUpdated = true;
      }

      if (!tsconfigBuild.exclude) {
        tsconfigBuild.exclude = [];
      }

      const hasEntryClientExclude = tsconfigBuild.exclude.some((pattern: string) =>
        pattern.includes('entry-client.tsx')
      );

      if (!hasEntryClientExclude) {
        tsconfigBuild.exclude.push('src/views/entry-client.tsx');
        buildUpdated = true;
      }

      if (buildUpdated) {
        writeFileSync(tsconfigBuildPath, JSON.stringify(tsconfigBuild, null, 2));
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
          pattern.includes('entry-client.tsx')
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

    // 6. Setup build scripts
    consola.start('Configuring build scripts...');
    const packageJsonPath = join(cwd, 'package.json');

    if (!existsSync(packageJsonPath)) {
      consola.warn('No package.json found, skipping build script setup');
    } else {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

        if (!packageJson.scripts) {
          packageJson.scripts = {};
        }

        let shouldUpdate = false;

        // Add build:client script if not present
        if (!packageJson.scripts['build:client']) {
          packageJson.scripts['build:client'] = 'vite build --ssrManifest --outDir dist/client';
          shouldUpdate = true;
        }

        // Add build:server script if not present
        if (!packageJson.scripts['build:server']) {
          packageJson.scripts['build:server'] = `vite build --ssr ${viewsDir}/entry-server.tsx --outDir dist/server`;
          shouldUpdate = true;
        }

        // Update main build script
        const existingBuild = packageJson.scripts.build;
        const recommendedBuild = 'pnpm build:client && pnpm build:server && nest build';

        if (!existingBuild) {
          // No build script exists, create one
          packageJson.scripts.build = recommendedBuild;
          shouldUpdate = true;
        } else if (!existingBuild.includes('build:client') || !existingBuild.includes('build:server')) {
          // Build script exists but doesn't include our scripts
          consola.warn(`Found existing build script: "${existingBuild}"`);
          consola.info('SSR requires building client and server bundles');
          consola.info(`Recommended: ${recommendedBuild}`);
          consola.info('Please manually update your build script in package.json');
        } else {
          consola.info('Build scripts already configured');
        }

        if (shouldUpdate) {
          writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
          consola.success('Updated build scripts in package.json');
        }

        // 7. Check and install dependencies
        if (!args['skip-install']) {
          consola.start('Checking dependencies...');
          const requiredDeps = {
            'react': '^19.0.0',
            'react-dom': '^19.0.0',
            'vite': '^7.0.0',
            '@vitejs/plugin-react': '^4.0.0'
          };

          const missingDeps: string[] = [];
          const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

          for (const [dep, version] of Object.entries(requiredDeps)) {
            if (!allDeps[dep]) {
              missingDeps.push(`${dep}@${version}`);
            }
          }

          if (missingDeps.length > 0) {
            consola.info(`Missing dependencies: ${missingDeps.join(', ')}`);

            // Detect package manager
            let packageManager = 'npm';
            if (existsSync(join(cwd, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
            else if (existsSync(join(cwd, 'yarn.lock'))) packageManager = 'yarn';

            const installCmd = packageManager === 'npm'
              ? `npm install ${missingDeps.join(' ')}`
              : `${packageManager} add ${missingDeps.join(' ')}`;

            try {
              consola.start(`Installing dependencies with ${packageManager}...`);
              execSync(installCmd, {
                cwd,
                stdio: 'inherit'
              });
              consola.success('Dependencies installed!');
            } catch (error) {
              consola.error('Failed to install dependencies:', error);
              consola.info(`Please manually run: ${installCmd}`);
            }
          } else {
            consola.success('All required dependencies are already installed');
          }
        }
      } catch (error) {
        consola.error('Failed to update package.json:', error);
      }
    }

    consola.success('\nInitialization complete!');
    consola.box('Next steps');
    consola.info(`1. Create your first view component in ${viewsDir}/`);
    consola.info('2. Render it from a NestJS controller using render.render()');
    consola.info('3. Run your dev server with: pnpm start:dev');
  },
});

runMain(main);
