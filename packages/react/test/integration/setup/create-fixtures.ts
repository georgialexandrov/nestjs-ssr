import { execSync } from 'child_process';
import {
  existsSync,
  rmSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { basename, join, dirname } from 'path';
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
const NEST_CLI = join(PACKAGE_ROOT, 'node_modules/.bin/nest');
const COUNTER_COMPONENT = join(__dirname, 'counter.tsx');
const LAYOUT_COMPONENT = join(__dirname, 'layout.tsx');
const ITEMS_LAYOUT_COMPONENT = join(__dirname, 'items-layout.tsx');
const ITEM_LIST_COMPONENT = join(__dirname, 'item-list.tsx');
const ITEM_DETAIL_COMPONENT = join(__dirname, 'item-detail.tsx');

/**
 * Single-quote a path for the shell.
 *
 * Every path here is derived from __dirname, so a checkout under a directory
 * with a space ("/Users/my name/dev") silently split into two arguments.
 * Quoting also settles CodeQL's js/shell-command-injection-from-environment
 * on these call sites.
 */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function createFixture(config: FixtureConfig): Promise<void> {
  const fixturePath = join(FIXTURES_DIR, config.name);

  console.log(`\n📦 Creating fixture: ${config.name}`);
  console.log(`   SSR: ${config.ssrMode}, Port: ${config.nestPort}`);

  // 1. Clean existing fixture
  if (existsSync(fixturePath)) {
    console.log('   Cleaning existing fixture...');
    rmSync(fixturePath, { recursive: true, force: true });
  }

  // 2. Run nest new
  console.log('   Running nest new...');
  execSync(
    `${shellQuote(NEST_CLI)} new ${config.name} --package-manager pnpm --skip-git --skip-install`,
    {
      cwd: FIXTURES_DIR,
      stdio: 'pipe',
    },
  );

  // 3. Install NestJS dependencies first
  console.log('   Installing NestJS dependencies...');
  execSync('pnpm install --ignore-workspace', {
    cwd: fixturePath,
    stdio: 'pipe',
  });

  // 4. Install local @nestjs-ssr/react as a packed tarball.
  //
  // `pnpm link` leaves the library resolving its own peers — @nestjs/core in
  // particular — from the workspace, while the fixture app resolves them from
  // its own node_modules. Two copies of @nestjs/core means two distinct
  // HttpAdapterHost classes, and Nest cannot match the DI token:
  //   "Nest can't resolve dependencies of the ViteInitializerService
  //    (RenderService, ?, ...)"
  // The whole suite then fails at startup whenever the workspace and the
  // fixture resolve different patch versions.
  //
  // Installing the tarball puts the library inside the fixture's own
  // node_modules, so its peers resolve to the fixture's copies — which is also
  // how real consumers install it.
  console.log('   Packing @nestjs-ssr/react...');
  const tarballName = execSync('pnpm pack --pack-destination .', {
    cwd: PACKAGE_ROOT,
    stdio: 'pipe',
  })
    .toString()
    .trim()
    .split('\n')
    .pop()!
    .trim();
  const tarballPath = join(PACKAGE_ROOT, basename(tarballName));

  console.log('   Installing @nestjs-ssr/react...');
  execSync(`pnpm add --ignore-workspace ${shellQuote(tarballPath)}`, {
    cwd: fixturePath,
    stdio: 'pipe',
  });

  // 5. Run init script (skip install since we'll use pnpm)
  console.log('   Running init script...');
  execSync(
    `node ${shellQuote(`${PACKAGE_ROOT}/dist/cli/init.mjs`)} --port ${config.vitePort} --skip-install`,
    {
      cwd: fixturePath,
      stdio: 'pipe',
    },
  );

  // 6. Install required dependencies using pnpm
  //
  // Exact pins, not ranges. Two reasons:
  //  - .npmrc sets minimum-release-age=10080, so a range can resolve to a
  //    release too new to install, and the fixture build fails for reasons
  //    unrelated to the code under test.
  //  - A fixture that silently drifts to a different toolchain than the one
  //    the workspace develops against stops testing what we ship. These match
  //    packages/react's own devDependencies.
  console.log('   Installing dependencies...');
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

  execSync(`pnpm add --ignore-workspace ${deps.join(' ')}`, {
    cwd: fixturePath,
    stdio: 'pipe',
  });
  execSync(`pnpm add --ignore-workspace -D ${devDeps.join(' ')}`, {
    cwd: fixturePath,
    stdio: 'pipe',
  });

  // 6. Create views directory and copy components
  const viewsDir = join(fixturePath, 'src/views');
  mkdirSync(viewsDir, { recursive: true });
  copyFileSync(COUNTER_COMPONENT, join(viewsDir, 'counter.tsx'));
  copyFileSync(LAYOUT_COMPONENT, join(viewsDir, 'layout.tsx'));
  copyFileSync(ITEMS_LAYOUT_COMPONENT, join(viewsDir, 'items-layout.tsx'));
  copyFileSync(ITEM_LIST_COMPONENT, join(viewsDir, 'item-list.tsx'));
  copyFileSync(ITEM_DETAIL_COMPONENT, join(viewsDir, 'item-detail.tsx'));
  console.log(
    '   Copied components (counter, layout, items-layout, item-list, item-detail)',
  );

  // 7. Update app.module.ts with correct RenderModule config
  const appModulePath = join(fixturePath, 'src/app.module.ts');
  const appModuleContent = generateAppModule(config);
  writeFileSync(appModulePath, appModuleContent);
  console.log('   Updated app.module.ts');

  // 8. Update app.controller.ts with @Render decorator
  const appControllerPath = join(fixturePath, 'src/app.controller.ts');
  const appControllerContent = generateAppController();
  writeFileSync(appControllerPath, appControllerContent);
  console.log('   Updated app.controller.ts');

  // 8b. Create items.controller.ts with @Layout decorator
  const itemsControllerPath = join(fixturePath, 'src/items.controller.ts');
  const itemsControllerContent = generateItemsController();
  writeFileSync(itemsControllerPath, itemsControllerContent);
  console.log('   Created items.controller.ts');

  // 9. Update main.ts with correct port (use env PORT with dev port as fallback)
  const mainTsPath = join(fixturePath, 'src/main.ts');
  let mainTs = readFileSync(mainTsPath, 'utf-8');
  // Use process.env.PORT with config.nestPort as fallback (for prod mode testing)
  const portExpression = `process.env.PORT ? Number(process.env.PORT) : ${config.nestPort}`;
  mainTs = mainTs.replace(
    /listen\(process\.env\.PORT \?\? \d+\)/,
    `listen(${portExpression})`,
  );
  mainTs = mainTs.replace(/listen\(\d+\)/, `listen(${portExpression})`);
  mainTs = mainTs.replace(/localhost:\d+/, `localhost:${config.nestPort}`);
  writeFileSync(mainTsPath, mainTs);
  console.log('   Updated main.ts port');

  // 10. Update Vite port in vite.config.ts and package.json
  if (config.vitePort !== null) {
    // Update vite.config.ts
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

    // Update package.json dev:vite script
    const pkgJsonPath = join(fixturePath, 'package.json');
    let pkgJson = readFileSync(pkgJsonPath, 'utf-8');
    pkgJson = pkgJson.replace(/--port 5173/g, `--port ${config.vitePort}`);
    writeFileSync(pkgJsonPath, pkgJson);
    console.log(`   Updated package.json dev:vite port to ${config.vitePort}`);
  }

  console.log(`   ✅ Fixture ${config.name} created successfully`);
}

function generateAppModule(config: FixtureConfig): string {
  const vitePort = config.vitePort || 5173;
  return `import { Module } from '@nestjs/common';
import { RenderModule } from '@nestjs-ssr/react';
import { AppController } from './app.controller';
import { ItemsController } from './items.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    RenderModule.forRoot({
      mode: '${config.ssrMode}',
      vite: { port: ${vitePort} },
    }),
  ],
  controllers: [AppController, ItemsController],
  providers: [AppService],
})
export class AppModule {}
`;
}

function generateAppController(): string {
  return `import { Controller, Get } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';
import { AppService } from './app.service';
import Counter from './views/counter';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Render(Counter)
  getCounter() {
    return {
      message: this.appService.getHello(),
    };
  }
}
`;
}

function generateItemsController(): string {
  return `import { Controller, Get, Param } from '@nestjs/common';
import { Render, Layout } from '@nestjs-ssr/react';
import ItemsLayout from './views/items-layout';
import ItemList from './views/item-list';
import ItemDetail from './views/item-detail';

const ITEMS = [
  { id: 1, name: 'Widget', description: 'A useful widget' },
  { id: 2, name: 'Gadget', description: 'A cool gadget' },
  { id: 3, name: 'Doohickey', description: 'An interesting doohickey' },
];

@Controller('items')
@Layout(ItemsLayout)
export class ItemsController {
  @Get()
  @Render(ItemList)
  getItems() {
    return { items: ITEMS };
  }

  @Get(':id')
  @Render(ItemDetail)
  getItem(@Param('id') id: string) {
    const item = ITEMS.find((i) => i.id === Number(id)) || ITEMS[0];
    return { item };
  }
}
`;
}

async function main() {
  console.log('🚀 Creating integration test fixtures...');
  console.log(`   Output directory: ${FIXTURES_DIR}`);

  // Ensure fixtures directory exists
  mkdirSync(FIXTURES_DIR, { recursive: true });

  // Create all fixtures in parallel
  const startTime = Date.now();

  await Promise.all(FIXTURES.map((config) => createFixture(config)));

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ All fixtures created in ${duration}s`);
}

main().catch((error) => {
  console.error('❌ Failed to create fixtures:', error);
  process.exit(1);
});
