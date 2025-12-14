import { execSync } from 'child_process';
import {
  existsSync,
  rmSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FIXTURES, type FixtureConfig } from './port-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, '../fixtures');
const PACKAGE_ROOT = join(__dirname, '../../..');
const COUNTER_COMPONENT = join(__dirname, 'counter.tsx');

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
    `npx @nestjs/cli new ${config.name} --package-manager pnpm --skip-git --skip-install`,
    {
      cwd: FIXTURES_DIR,
      stdio: 'pipe',
    },
  );

  // 3. Install NestJS dependencies first
  console.log('   Installing NestJS dependencies...');
  execSync('pnpm install', {
    cwd: fixturePath,
    stdio: 'pipe',
  });

  // 4. Link local @nestjs-ssr/react package
  console.log('   Linking @nestjs-ssr/react...');
  execSync(`pnpm link ${PACKAGE_ROOT}`, {
    cwd: fixturePath,
    stdio: 'pipe',
  });

  // 5. Run init script (skip install since we'll use pnpm)
  console.log('   Running init script...');
  execSync(
    `node ${PACKAGE_ROOT}/dist/cli/init.mjs --port ${config.vitePort} --skip-install`,
    {
      cwd: fixturePath,
      stdio: 'pipe',
    },
  );

  // 6. Install required dependencies using pnpm
  console.log('   Installing dependencies...');
  const deps = [
    'react@^19.0.0',
    'react-dom@^19.0.0',
    'http-proxy-middleware@^3.0.0',
  ];
  const devDeps = [
    'vite@^7.0.0',
    '@vitejs/plugin-react@^4.0.0',
    '@types/react@^19.0.0',
    '@types/react-dom@^19.0.0',
    'concurrently@^9.0.0',
  ];

  execSync(`pnpm add ${deps.join(' ')}`, { cwd: fixturePath, stdio: 'pipe' });
  execSync(`pnpm add -D ${devDeps.join(' ')}`, {
    cwd: fixturePath,
    stdio: 'pipe',
  });

  // 6. Create views directory and copy counter component
  const viewsDir = join(fixturePath, 'src/views');
  mkdirSync(viewsDir, { recursive: true });
  copyFileSync(COUNTER_COMPONENT, join(viewsDir, 'counter.tsx'));
  console.log('   Copied counter component');

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
import { AppService } from './app.service';

@Module({
  imports: [
    RenderModule.forRoot({
      mode: '${config.ssrMode}',
      vite: { port: ${vitePort} },
    }),
  ],
  controllers: [AppController],
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
