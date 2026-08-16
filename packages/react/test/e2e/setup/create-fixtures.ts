import { execFileSync } from 'child_process';
import {
  existsSync,
  rmSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FIXTURES, type FixtureConfig } from './port-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, '../fixtures');
const PACKAGE_ROOT = join(__dirname, '../../..');

// Resolve the Nest CLI from this package's own node_modules. Relying on
// `npx @nestjs/cli` makes fixture creation depend on a network fetch and on
// npx's cache, which fails intermittently with "nest: command not found" and
// would make the CI browser job flaky for reasons unrelated to the code.
const NEST_CLI = join(PACKAGE_ROOT, 'node_modules/@nestjs/cli/bin/nest.js');
const PNPM_CLI = process.env.npm_execpath;
const REFERENCE_DIR = join(__dirname, 'reference');

/** Execute pnpm without a command shell, preserving argument boundaries. */
function pnpm(args: string[], options: { cwd: string; stdio: 'pipe' }) {
  if (!PNPM_CLI) {
    throw new Error(
      'npm_execpath is unavailable; run this fixture setup via pnpm',
    );
  }
  return execFileSync(process.execPath, [PNPM_CLI, ...args], options);
}

async function createFixture(config: FixtureConfig): Promise<void> {
  const fixturePath = join(FIXTURES_DIR, config.name);

  console.log(`\n📦 Creating fixture: ${config.name}`);
  console.log(`   Adapter: ${config.adapter}, Port: ${config.nestPort}`);

  // 1. Clean existing fixture
  if (existsSync(fixturePath)) {
    console.log('   Cleaning existing fixture...');
    rmSync(fixturePath, { recursive: true, force: true });
  }

  // 2. Build the package
  console.log('   Building @nestjs-ssr/react...');
  pnpm(['build'], { cwd: PACKAGE_ROOT, stdio: 'pipe' });

  // 3. Pack tarball
  console.log('   Packing tarball...');
  pnpm(['pack', '--pack-destination', FIXTURES_DIR], {
    cwd: PACKAGE_ROOT,
    stdio: 'pipe',
  });

  // Find the tarball
  const tarball = readdirSync(FIXTURES_DIR).find(
    (f) => f.startsWith('nestjs-ssr-react-') && f.endsWith('.tgz'),
  );
  if (!tarball) {
    throw new Error('Could not find packed tarball');
  }
  const tarballPath = join(FIXTURES_DIR, tarball);
  console.log(`   Tarball: ${tarball}`);

  // 4. Run nest new
  console.log('   Running nest new...');
  execFileSync(
    process.execPath,
    [
      NEST_CLI,
      'new',
      config.name,
      '--package-manager',
      'pnpm',
      '--skip-git',
      '--skip-install',
    ],
    {
      cwd: FIXTURES_DIR,
      stdio: 'pipe',
    },
  );

  // 5. Install NestJS dependencies
  console.log('   Installing NestJS dependencies...');
  pnpm(['install', '--ignore-workspace'], {
    cwd: fixturePath,
    stdio: 'pipe',
  });

  // 6. Install tarball (real install, not symlink)
  console.log('   Installing @nestjs-ssr/react from tarball...');
  pnpm(['add', '--ignore-workspace', tarballPath], {
    cwd: fixturePath,
    stdio: 'pipe',
  });

  // 7. Install adapter-specific dependencies
  console.log(`   Installing ${config.adapter} adapter deps...`);
  if (config.adapter === 'fastify') {
    pnpm(
      [
        'add',
        '--ignore-workspace',
        '@nestjs/platform-fastify',
        '@fastify/static',
        'fastify',
      ],
      {
        cwd: fixturePath,
        stdio: 'pipe',
      },
    );
  }
  // Express adapter is already installed by nest new

  // 8. Run init script
  const vitePort = config.vitePort || 5173;
  console.log('   Running init script...');
  execFileSync(
    process.execPath,
    [
      join(PACKAGE_ROOT, 'dist/cli/init.mjs'),
      '--port',
      String(vitePort),
      '--skip-install',
    ],
    {
      cwd: fixturePath,
      stdio: 'pipe',
    },
  );

  // 9. Install React + Vite deps
  console.log('   Installing React + Vite dependencies...');
  // Exact pins: .npmrc sets minimum-release-age=10080, so a range can resolve
  // to a release too new to install, and a fixture that drifts to a different
  // toolchain than the workspace stops testing what we ship. These match
  // packages/react's own devDependencies.
  const deps = [
    'react@19.2.8',
    'react-dom@19.2.8',
    'http-proxy-middleware@4.2.0',
  ];
  // Vite and the React plugin must be a matching pair. plugin-react 4 predates
  // Vite 7, and that combination produced "require_react is not a function"
  // from Vite's dependency optimizer, which killed entry-client before
  // hydrateRoot and left every page inert.
  const devDeps = [
    'vite@8.2.1',
    '@vitejs/plugin-react@6.0.5',
    '@types/react@19.2.18',
    '@types/react-dom@19.2.4',
    'concurrently@9.2.4',
  ];

  pnpm(['add', '--ignore-workspace', ...deps], {
    cwd: fixturePath,
    stdio: 'pipe',
  });
  pnpm(['add', '--ignore-workspace', '-D', ...devDeps], {
    cwd: fixturePath,
    stdio: 'pipe',
  });

  // 10. Copy reference view components
  const viewsDir = join(fixturePath, 'src/views');
  mkdirSync(viewsDir, { recursive: true });

  const viewFiles = [
    'layout.tsx',
    'recipes-layout.tsx',
    'home.tsx',
    'recipe-list.tsx',
    'recipe-detail.tsx',
  ];
  for (const file of viewFiles) {
    copyFileSync(join(REFERENCE_DIR, 'views', file), join(viewsDir, file));
  }
  console.log('   Copied view components');

  // 11. Copy service and controllers
  copyFileSync(
    join(REFERENCE_DIR, 'recipes.service.ts'),
    join(fixturePath, 'src/recipes.service.ts'),
  );
  copyFileSync(
    join(REFERENCE_DIR, 'recipes.controller.ts'),
    join(fixturePath, 'src/recipes.controller.ts'),
  );
  copyFileSync(
    join(REFERENCE_DIR, 'app.controller.ts'),
    join(fixturePath, 'src/app.controller.ts'),
  );
  console.log('   Copied controllers and service');

  // 12. Write app.module.ts
  const appModulePath = join(fixturePath, 'src/app.module.ts');
  writeFileSync(appModulePath, generateAppModule(config));
  console.log('   Updated app.module.ts');

  // 13. Write main.ts from adapter template
  const mainTsPath = join(fixturePath, 'src/main.ts');
  const mainTemplate = readFileSync(
    join(REFERENCE_DIR, 'adapters', `${config.adapter}-main.ts`),
    'utf-8',
  );
  // Replace the import path — template uses './app.module' which is correct
  writeFileSync(mainTsPath, mainTemplate);
  console.log(`   Updated main.ts (${config.adapter} adapter)`);

  // 14. Update Vite port in vite.config.ts and package.json
  if (config.vitePort !== null) {
    const viteConfigPath = join(fixturePath, 'vite.config.ts');
    if (existsSync(viteConfigPath)) {
      let viteConfig = readFileSync(viteConfigPath, 'utf-8');
      viteConfig = viteConfig.replace(
        /port: 5173/g,
        `port: ${config.vitePort}`,
      );
      writeFileSync(viteConfigPath, viteConfig);
      console.log(`   Updated vite.config.ts port to ${config.vitePort}`);
    }

    const pkgJsonPath = join(fixturePath, 'package.json');
    let pkgJson = readFileSync(pkgJsonPath, 'utf-8');
    pkgJson = pkgJson.replace(/--port 5173/g, `--port ${config.vitePort}`);
    writeFileSync(pkgJsonPath, pkgJson);
    console.log(`   Updated package.json dev:vite port to ${config.vitePort}`);
  }

  // 15. Update NestJS port in main.ts
  const mainTs = readFileSync(join(fixturePath, 'src/main.ts'), 'utf-8');
  const updatedMain = mainTs
    .replace(/port: \d+/, `port: ${config.nestPort}`)
    .replace(
      /Number\(process\.env\.PORT\) : \d+/,
      `Number(process.env.PORT) : ${config.nestPort}`,
    )
    .replace(/localhost:\d+/g, `localhost:${config.nestPort}`);
  writeFileSync(join(fixturePath, 'src/main.ts'), updatedMain);
  console.log(`   Updated main.ts port to ${config.nestPort}`);

  console.log(`   ✅ Fixture ${config.name} created successfully`);
}

function generateAppModule(config: FixtureConfig): string {
  const vitePort = config.vitePort || 5173;
  return `import { Module } from '@nestjs/common';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  imports: [
    RenderModule.forRoot({
      vite: { port: ${vitePort} },
    }),
  ],
  controllers: [AppController, RecipesController],
  providers: [RecipesService],
})
export class AppModule {}
`;
}

async function main() {
  console.log('🚀 Creating E2E test fixtures...');
  console.log(`   Output directory: ${FIXTURES_DIR}`);

  // Ensure fixtures directory exists
  mkdirSync(FIXTURES_DIR, { recursive: true });

  const startTime = Date.now();

  // Create fixtures sequentially to avoid tarball conflicts
  for (const config of FIXTURES) {
    await createFixture(config);
  }

  // Clean up tarball
  const tarballs = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.tgz'));
  for (const t of tarballs) {
    rmSync(join(FIXTURES_DIR, t));
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ All E2E fixtures created in ${duration}s`);
}

main().catch((error) => {
  console.error('❌ Failed to create fixtures:', error);
  process.exit(1);
});
