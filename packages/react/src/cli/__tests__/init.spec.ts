import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cli = vi.hoisted(() => ({
  command: null as null | { run: (context: { args: any }) => void },
  runMain: vi.fn(),
}));

const mockedConsola = vi.hoisted(() => ({
  box: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  log: vi.fn(),
  start: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('citty', () => ({
  defineCommand: vi.fn((command) => {
    cli.command = command;
    return command;
  }),
  runMain: cli.runMain,
}));

vi.mock('consola', () => ({
  consola: mockedConsola,
}));

describe('init CLI', () => {
  const originalCwd = process.cwd();
  const tempProjects: string[] = [];

  beforeAll(async () => {
    await import('../init');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    for (const projectDir of tempProjects) {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  function createProject(options?: {
    packageJson?: Record<string, unknown>;
    tsconfig?: Record<string, unknown>;
    tsconfigBuild?: Record<string, unknown>;
    nestCli?: Record<string, unknown>;
    mainTs?: string;
    appModuleTs?: string;
  }) {
    const projectDir = mkdtempSync(join(tmpdir(), 'nestjs-ssr-init-'));
    tempProjects.push(projectDir);

    mkdirSync(join(projectDir, 'src'), { recursive: true });

    writeJson(
      projectDir,
      'package.json',
      options?.packageJson ?? {
        scripts: {
          build: 'nest build',
          start: 'nest start',
        },
        dependencies: {
          '@nestjs/common': '^11.0.0',
          '@nestjs/core': '^11.0.0',
          '@nestjs/platform-express': '^11.0.0',
        },
        devDependencies: {},
      },
    );

    writeJson(
      projectDir,
      'tsconfig.json',
      options?.tsconfig ?? {
        compilerOptions: {
          module: 'commonjs',
          moduleResolution: 'node',
        },
        include: ['src/**/*.ts'],
        exclude: ['node_modules', 'dist'],
      },
    );

    if (options?.tsconfigBuild) {
      writeJson(projectDir, 'tsconfig.build.json', options.tsconfigBuild);
    }

    if (options?.nestCli) {
      writeJson(projectDir, 'nest-cli.json', options.nestCli);
    }

    writeFileSync(
      join(projectDir, 'src/main.ts'),
      options?.mainTs ??
        `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
void bootstrap();
`,
    );

    writeFileSync(
      join(projectDir, 'src/app.module.ts'),
      options?.appModuleTs ??
        `import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
`,
    );

    return projectDir;
  }

  function runInit(
    projectDir: string,
    args: Partial<{
      force: boolean;
      views: string;
      'skip-install': boolean;
      port: string;
      project: string;
    }> = {},
  ) {
    expect(cli.command).toBeTruthy();
    process.chdir(projectDir);
    cli.command!.run({
      args: {
        force: false,
        views: 'src/views',
        'skip-install': true,
        port: '5173',
        ...args,
      },
    });
  }

  function read(projectDir: string, path: string) {
    return readFileSync(join(projectDir, path), 'utf-8');
  }

  function readJson<T>(projectDir: string, path: string): T {
    return JSON.parse(read(projectDir, path)) as T;
  }

  function writeJson(
    projectDir: string,
    path: string,
    value: Record<string, unknown>,
  ) {
    writeFileSync(join(projectDir, path), JSON.stringify(value, null, 2));
  }

  function countOccurrences(text: string, value: string) {
    return text.split(value).length - 1;
  }

  it('creates a runnable SSR project skeleton for a fresh NestJS app', () => {
    const projectDir = createProject({
      nestCli: {
        compilerOptions: {
          builder: 'swc',
          deleteOutDir: true,
        },
      },
      mainTs: `import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  await app.listen(3000);
}
void bootstrap();
`,
      appModuleTs: `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
`,
    });

    runInit(projectDir, { port: '4242' });

    const entryClient = read(projectDir, 'src/views/entry-client.tsx');
    const entryServer = read(projectDir, 'src/views/entry-server.tsx');
    const indexHtml = read(projectDir, 'src/views/index.html');

    expect(entryClient).toContain('hydrateRoot');
    expect(entryClient).toContain("import.meta.glob(['@/**/views/**/*.tsx'");
    expect(entryServer).toContain('renderComponent');
    expect(entryServer).toContain('renderComponentStream');
    expect(indexHtml).toContain('<div id="root"><!--app-html--></div>');
    expect(indexHtml).toContain('<!--initial-state-->');
    expect(indexHtml).toContain('<!--client-scripts-->');

    const viteConfig = read(projectDir, 'vite.config.ts');
    expect(viteConfig).toContain('port: 4242');
    expect(viteConfig).toContain('hmr: { port: 4242 }');
    expect(viteConfig).toContain(
      "client: resolve(__dirname, 'src/views/entry-client.tsx')",
    );
    expect(viteConfig).toContain('defineConfig(({ isSsrBuild })');
    expect(viteConfig).toContain("id.endsWith('.node')");

    const tsconfig = readJson<{
      compilerOptions: {
        module: string;
        moduleResolution: string;
        jsx: string;
        paths: Record<string, string[]>;
      };
      include: string[];
      exclude: string[];
    }>(projectDir, 'tsconfig.json');
    expect(tsconfig.compilerOptions).toMatchObject({
      module: 'nodenext',
      moduleResolution: 'nodenext',
      jsx: 'react-jsx',
    });
    expect(tsconfig.compilerOptions.paths['@/*']).toEqual(['./src/*']);
    expect(tsconfig.include).toContain('src/**/*.tsx');
    expect(tsconfig.exclude).toContain('src/views/entry-client.tsx');

    const tsconfigBuild = readJson<{ extends: string; exclude: string[] }>(
      projectDir,
      'tsconfig.build.json',
    );
    expect(tsconfigBuild.extends).toBe('./tsconfig.json');
    expect(tsconfigBuild.exclude).toEqual(
      expect.arrayContaining([
        'node_modules',
        'test',
        'dist',
        '**/*spec.ts',
        'src/views/entry-client.tsx',
      ]),
    );

    const nestCli = readJson<{
      compilerOptions: {
        builder: {
          type: string;
          options: { extensions: string[] };
        };
        deleteOutDir: boolean;
      };
      exclude: string[];
    }>(projectDir, 'nest-cli.json');
    expect(nestCli.compilerOptions.deleteOutDir).toBe(true);
    expect(nestCli.compilerOptions.builder).toEqual({
      type: 'swc',
      options: { extensions: ['.js', '.ts', '.tsx'] },
    });
    expect(nestCli.exclude).toContain('**/entry-client.tsx');

    const swcrc = readJson<{
      jsc: {
        parser: { tsx: boolean; decorators: boolean };
        transform: { react: { runtime: string } };
      };
    }>(projectDir, '.swcrc');
    expect(swcrc.jsc.parser.tsx).toBe(true);
    expect(swcrc.jsc.parser.decorators).toBe(true);
    expect(swcrc.jsc.transform.react.runtime).toBe('automatic');

    const mainTs = read(projectDir, 'src/main.ts');
    expect(mainTs).toContain('app.enableShutdownHooks();');
    expect(mainTs.indexOf('NestFactory.create')).toBeLessThan(
      mainTs.indexOf('app.enableShutdownHooks();'),
    );

    const appModule = read(projectDir, 'src/app.module.ts');
    expect(appModule).toContain(
      "import { RenderModule } from '@nestjs-ssr/react';",
    );
    expect(appModule).toContain(
      'ConfigModule, RenderModule.forRoot({ vite: { port: 4242 } })',
    );

    const packageJson = readJson<{
      scripts: Record<string, string>;
    }>(projectDir, 'package.json');
    expect(packageJson.scripts).toMatchObject({
      build: 'nest build && pnpm build:client && pnpm build:server',
      'build:client':
        'vite build --config vite.config.ts --ssrManifest --outDir dist/client && cp src/views/index.html dist/client/index.html',
      'build:server':
        'vite build --config vite.config.ts --ssr src/views/entry-server.tsx --outDir dist/server',
      'dev:vite': 'vite --config vite.config.ts --port 4242',
      'dev:nest': 'nest start --watch --watchAssets --preserveWatchOutput',
    });
    expect(packageJson.scripts['start:dev']).toContain('concurrently --raw');
  });

  it('honors a custom views directory across generated files and compiler excludes', () => {
    const projectDir = createProject();

    runInit(projectDir, { views: 'src/ui/pages', port: '3333' });

    expect(existsSync(join(projectDir, 'src/ui/pages/entry-client.tsx'))).toBe(
      true,
    );
    expect(existsSync(join(projectDir, 'src/ui/pages/entry-server.tsx'))).toBe(
      true,
    );
    expect(existsSync(join(projectDir, 'src/ui/pages/index.html'))).toBe(true);

    const tsconfig = readJson<{ exclude: string[] }>(
      projectDir,
      'tsconfig.json',
    );
    expect(tsconfig.exclude).toContain('src/ui/pages/entry-client.tsx');
    expect(tsconfig.exclude).not.toContain('src/views/entry-client.tsx');

    const tsconfigBuild = readJson<{ exclude: string[] }>(
      projectDir,
      'tsconfig.build.json',
    );
    expect(tsconfigBuild.exclude).toContain('src/ui/pages/entry-client.tsx');
    expect(tsconfigBuild.exclude).not.toContain('src/views/entry-client.tsx');

    const viteConfig = read(projectDir, 'vite.config.ts');
    expect(viteConfig).toContain(
      "client: resolve(__dirname, 'src/ui/pages/entry-client.tsx')",
    );

    const packageJson = readJson<{ scripts: Record<string, string> }>(
      projectDir,
      'package.json',
    );
    expect(packageJson.scripts['build:client']).toContain(
      'cp src/ui/pages/index.html dist/client/index.html',
    );
    expect(packageJson.scripts['build:server']).toContain(
      'vite build --config vite.config.ts --ssr src/ui/pages/entry-server.tsx --outDir dist/server',
    );

    const appModule = read(projectDir, 'src/app.module.ts');
    expect(appModule).toContain(
      'RenderModule.forRoot({ vite: { port: 3333 } })',
    );
  });

  it('preserves existing view entry files unless force is enabled', () => {
    const projectDir = createProject();
    mkdirSync(join(projectDir, 'src/views'), { recursive: true });
    writeFileSync(
      join(projectDir, 'src/views/entry-client.tsx'),
      'custom client entry',
    );

    runInit(projectDir);

    expect(read(projectDir, 'src/views/entry-client.tsx')).toBe(
      'custom client entry',
    );

    runInit(projectDir, { force: true });

    expect(read(projectDir, 'src/views/entry-client.tsx')).toContain(
      'hydrateRoot',
    );
  });

  it('is idempotent when rerun on an initialized project', () => {
    const projectDir = createProject({
      nestCli: {
        compilerOptions: {
          builder: {
            type: 'swc',
            options: { extensions: ['.js', '.ts', '.tsx'] },
          },
        },
        exclude: ['dist'],
      },
    });

    runInit(projectDir);
    runInit(projectDir);

    const appModule = read(projectDir, 'src/app.module.ts');
    expect(
      countOccurrences(
        appModule,
        "import { RenderModule } from '@nestjs-ssr/react';",
      ),
    ).toBe(1);
    expect(countOccurrences(appModule, 'RenderModule.forRoot()')).toBe(1);

    const mainTs = read(projectDir, 'src/main.ts');
    expect(countOccurrences(mainTs, 'app.enableShutdownHooks();')).toBe(1);

    const tsconfig = readJson<{ exclude: string[] }>(
      projectDir,
      'tsconfig.json',
    );
    expect(
      tsconfig.exclude.filter((pattern) =>
        pattern.includes('entry-client.tsx'),
      ),
    ).toEqual(['src/views/entry-client.tsx']);

    const tsconfigBuild = readJson<{ exclude: string[] }>(
      projectDir,
      'tsconfig.build.json',
    );
    expect(
      tsconfigBuild.exclude.filter((pattern) =>
        pattern.includes('entry-client.tsx'),
      ),
    ).toEqual(['src/views/entry-client.tsx']);

    const nestCli = readJson<{ exclude: string[] }>(
      projectDir,
      'nest-cli.json',
    );
    expect(
      nestCli.exclude.filter((pattern) => pattern.includes('entry-client.tsx')),
    ).toEqual(['**/entry-client.tsx']);
  });

  it('preserves existing Vite config and reports the manual config to apply', () => {
    const projectDir = createProject();
    writeFileSync(
      join(projectDir, 'vite.config.ts'),
      'export default { existing: true };\n',
    );

    runInit(projectDir, { views: 'src/pages', port: '6060' });

    expect(read(projectDir, 'vite.config.ts')).toBe(
      'export default { existing: true };\n',
    );
    expect(mockedConsola.warn).toHaveBeenCalledWith(
      'vite.config already exists',
    );
    expect(mockedConsola.log).toHaveBeenCalledWith('    port: 6060,');
    expect(mockedConsola.log).toHaveBeenCalledWith(
      "      input: { client: resolve(__dirname, 'src/pages/entry-client.tsx') }",
    );

    const packageJson = readJson<{ scripts: Record<string, string> }>(
      projectDir,
      'package.json',
    );
    expect(packageJson.scripts['build:client']).toContain(
      'cp src/pages/index.html dist/client/index.html',
    );
    expect(packageJson.scripts['build:server']).toContain(
      'vite build --config vite.config.ts --ssr src/pages/entry-server.tsx --outDir dist/server',
    );
    expect(packageJson.scripts['dev:vite']).toBe(
      'vite --config vite.config.ts --port 6060',
    );
  });

  it('scaffolds a monorepo application under apps/<project>', () => {
    const projectDir = createProject({
      nestCli: {
        monorepo: true,
        root: 'apps/web',
        sourceRoot: 'apps/web/src',
        projects: {
          web: {
            type: 'application',
            root: 'apps/web',
            sourceRoot: 'apps/web/src',
            compilerOptions: {
              tsConfigPath: 'apps/web/tsconfig.app.json',
            },
          },
        },
      },
    });

    mkdirSync(join(projectDir, 'apps/web/src'), { recursive: true });
    writeJson(projectDir, 'apps/web/tsconfig.app.json', {
      extends: '../../tsconfig.json',
      compilerOptions: {
        outDir: '../../dist/apps/web',
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    });
    writeFileSync(
      join(projectDir, 'apps/web/src/main.ts'),
      `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();`,
    );
    writeFileSync(
      join(projectDir, 'apps/web/src/app.module.ts'),
      `import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
`,
    );

    runInit(projectDir, { project: 'web', port: '5174' });

    expect(
      existsSync(join(projectDir, 'apps/web/src/views/entry-client.tsx')),
    ).toBe(true);
    expect(existsSync(join(projectDir, 'apps/web/vite.config.ts'))).toBe(true);

    const appModule = read(projectDir, 'apps/web/src/app.module.ts');
    expect(appModule).toContain(
      "RenderModule.forRoot({ project: 'web', vite: { port: 5174 } })",
    );

    const packageJson = readJson<{ scripts: Record<string, string> }>(
      projectDir,
      'package.json',
    );
    expect(packageJson.scripts['dev:nest']).toContain('nest start web');
    expect(packageJson.scripts['dev:vite']).toContain(
      'vite --config apps/web/vite.config.ts',
    );
    expect(packageJson.scripts['start:dev']).toContain('NEST_SSR_PROJECT=web');
  });
});
