import { execFileSync, spawn, type ChildProcess } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { chromium, type Browser } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PACKAGE_ROOT = join(__dirname, '../..');
const REPO_ROOT = join(PACKAGE_ROOT, '../..');
const FIXTURES_DIR = join(__dirname, 'fixtures');
const APP_NAME = 'cli-init-smoke-app';
const APP_DIR = join(FIXTURES_DIR, APP_NAME);
const ROOT_LOCKFILE = join(REPO_ROOT, 'pnpm-lock.yaml');
const NEST_PORT = Number(process.env.CLI_INIT_SMOKE_PORT ?? 3337);
const VITE_PORT = Number(process.env.CLI_INIT_SMOKE_VITE_PORT ?? 5199);
const KEEP_FIXTURE = process.env.KEEP_CLI_INIT_SMOKE === '1';
// The app `nest new` scaffolds: Nest 12 makes an ES module project, Nest 11 a
// CommonJS one. The builder is the one in nest-cli.json.
const NEST_MAJOR = process.env.NEST_MAJOR === '11' ? '11' : '12';
// The fixture sits inside this package, and `nest new` resolves its
// schematics collection from the working directory upward, so a bare
// `nest new` would scaffold from this package's (Nest 12) collection whatever
// the CLI version. The Nest 11 CLI and collection are installed under
// aliases, as the integration fixtures use them.
const NEST_CLI = join(
  PACKAGE_ROOT,
  NEST_MAJOR === '11'
    ? 'node_modules/@nestjs/cli-11/bin/nest.js'
    : 'node_modules/@nestjs/cli/bin/nest.js',
);
const NEST_SCHEMATICS =
  NEST_MAJOR === '11' ? '@nestjs/schematics-11' : '@nestjs/schematics';
const BUILDER = (process.env.CLI_INIT_BUILDER ?? 'tsc') as
  'tsc' | 'swc' | 'webpack';
// What a user approves (`pnpm approve-builds`) after `nest new` on pnpm 11+,
// which otherwise fails every install. All of these come from Nest's own
// template or builder; init must not add to the list, so a dependency of ours
// that needs a build script fails this test.
const NEST_ALLOW_BUILDS = `allowBuilds:
  '@nestjs/core': true
  '@swc/core': true
  '@parcel/watcher': false
  unrs-resolver: true
`;

function run(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
): void {
  const display = [command, ...args].join(' ');
  console.log(`$ ${display}`);
  execFileSync(command, args, {
    cwd: options.cwd,
    stdio: 'inherit',
    env: { ...process.env, ...options.env },
  });
}

function cleanFixture(): void {
  rmSync(APP_DIR, { recursive: true, force: true });
  if (existsSync(FIXTURES_DIR)) {
    for (const file of readdirSync(FIXTURES_DIR)) {
      if (file.endsWith('.tgz')) {
        rmSync(join(FIXTURES_DIR, file), { force: true });
      }
    }
  }
}

function findPackedTarball(): string {
  const tarball = readdirSync(FIXTURES_DIR).find(
    (file) => file.startsWith('nestjs-ssr-react-') && file.endsWith('.tgz'),
  );
  if (!tarball) {
    throw new Error('Could not find @nestjs-ssr/react tarball after pnpm pack');
  }
  return join(FIXTURES_DIR, tarball);
}

function readRootLockfile(): string | null {
  return existsSync(ROOT_LOCKFILE)
    ? readFileSync(ROOT_LOCKFILE, 'utf-8')
    : null;
}

function writeSmokePage(): void {
  writeFileSync(
    join(APP_DIR, 'src/views/home.tsx'),
    `import { useState } from 'react';
import type { PageProps } from '@nestjs-ssr/react';

interface HomeProps {
  message: string;
  initialCount: number;
}

export default function Home({
  message,
  initialCount,
}: PageProps<HomeProps>) {
  const [count, setCount] = useState(initialCount);

  return (
    <main data-testid="home-page">
      <h1 data-testid="message">{message}</h1>
      <p data-testid="count">{count}</p>
      <button data-testid="increment" onClick={() => setCount((c) => c + 1)}>
        Increment
      </button>
    </main>
  );
}
`,
  );

  // Nest 12's `nest new` creates ES module projects, where relative imports
  // need the `.js` extension (init writes its own imports the same way).
  const isEsm =
    JSON.parse(readFileSync(join(APP_DIR, 'package.json'), 'utf-8')).type ===
    'module';
  writeFileSync(
    join(APP_DIR, 'src/app.controller.ts'),
    `import { Controller, Get } from '@nestjs/common';
import { Render, type RenderResponse } from '@nestjs-ssr/react';
import Home from './views/home${isEsm ? '.js' : ''}';

interface HomeProps {
  message: string;
  initialCount: number;
}

@Controller()
export class AppController {
  @Get()
  @Render(Home)
  getHome(): RenderResponse<HomeProps> {
    return {
      props: {
        message: 'CLI init smoke works',
        initialCount: 2,
      },
      head: {
        title: 'CLI Init Smoke',
        description: 'Fresh Nest app initialized by @nestjs-ssr/react',
      },
    };
  }
}
`,
  );
}

function assertInitOutput(): void {
  const packageJson = JSON.parse(
    readFileSync(join(APP_DIR, 'package.json'), 'utf-8'),
  ) as { scripts: Record<string, string> };
  const tsconfig = JSON.parse(
    readFileSync(join(APP_DIR, 'tsconfig.json'), 'utf-8'),
  ) as { compilerOptions: Record<string, unknown>; exclude: string[] };
  const appModule = readFileSync(join(APP_DIR, 'src/app.module.ts'), 'utf-8');
  const main = readFileSync(join(APP_DIR, 'src/main.ts'), 'utf-8');
  const template = readFileSync(join(APP_DIR, 'src/views/index.html'), 'utf-8');

  if (!appModule.includes('RenderModule.forRoot')) {
    throw new Error('init did not register RenderModule.forRoot');
  }
  if (!appModule.includes(`port: ${VITE_PORT}`)) {
    throw new Error(
      'init did not pass the requested Vite port to RenderModule',
    );
  }
  if (!main.includes('app.enableShutdownHooks();')) {
    throw new Error('init did not add app.enableShutdownHooks()');
  }
  if (!template.includes('<!--initial-state-->')) {
    throw new Error('init did not copy the SSR HTML template');
  }
  if (tsconfig.compilerOptions.jsx !== 'react-jsx') {
    throw new Error('init did not configure TSX support');
  }
  if (!tsconfig.exclude.includes('src/views/entry-client.tsx')) {
    throw new Error('init did not exclude entry-client.tsx from TS build');
  }
  if (!packageJson.scripts.build?.includes('build:client')) {
    throw new Error('init did not add the production build scripts');
  }
  if (!packageJson.scripts['dev:vite']?.includes(String(VITE_PORT))) {
    throw new Error('init did not configure the requested Vite port');
  }
}

async function waitForServer(
  proc: ChildProcess,
  url: string,
  logs: string[],
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    if (proc.exitCode !== null) {
      throw new Error(`Server exited before becoming ready.\n${logs.join('')}`);
    }

    try {
      const response = await fetch(url);
      if (response.status < 500) {
        return;
      }
    } catch {
      // Server is not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Server did not become ready at ${url}\n${logs.join('')}`);
}

function stopProcess(proc: ChildProcess): void {
  if (!proc.pid || proc.exitCode !== null) {
    return;
  }

  try {
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    try {
      proc.kill('SIGTERM');
    } catch {
      // Process already exited.
    }
  }
}

async function verifyRunningApp(): Promise<void> {
  const logs: string[] = [];
  // What Nest's start:prod runs. init keeps vite.config.ts out of the Nest
  // build so the app stays here rather than moving to dist/src/.
  const entry = 'dist/main.js';
  if (!existsSync(join(APP_DIR, entry))) {
    throw new Error(`${entry} is missing, so \`start:prod\` would fail`);
  }
  // The script itself, not the entry, so a broken start:prod fails here.
  const proc = spawn('pnpm', ['start:prod'], {
    cwd: APP_DIR,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(NEST_PORT),
    },
  });

  proc.stdout?.on('data', (chunk) => logs.push(chunk.toString()));
  proc.stderr?.on('data', (chunk) => logs.push(chunk.toString()));

  let browser: Browser | undefined;
  try {
    await waitForServer(proc, `http://localhost:${NEST_PORT}`, logs);

    const response = await fetch(`http://localhost:${NEST_PORT}`);
    const html = await response.text();
    if (!html.includes('CLI init smoke works')) {
      throw new Error('SSR HTML did not include controller data');
    }
    if (!html.includes('window.__INITIAL_STATE__')) {
      throw new Error('SSR HTML did not include hydration state');
    }
    if (!html.includes('<title>CLI Init Smoke</title>')) {
      throw new Error('SSR HTML did not include page head metadata');
    }

    browser = await chromium.launch();
    const page = await browser.newPage();
    const consoleMessages: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (
        message.type() === 'error' ||
        text.toLowerCase().includes('hydration') ||
        text.toLowerCase().includes('mismatch')
      ) {
        consoleMessages.push(text);
      }
    });

    await page.goto(`http://localhost:${NEST_PORT}`);
    await page.getByTestId('increment').click();
    const count = await page.getByTestId('count').textContent();
    if (count !== '3') {
      throw new Error(`Expected hydrated counter to reach 3, got ${count}`);
    }

    const hydrationErrors = consoleMessages.filter((message) => {
      const normalized = message.toLowerCase();
      return (
        normalized.includes('hydration') ||
        normalized.includes('mismatch') ||
        normalized.includes('did not match')
      );
    });
    if (hydrationErrors.length > 0) {
      throw new Error(
        `Hydration warnings found:\n${hydrationErrors.join('\n')}`,
      );
    }
  } finally {
    await browser?.close();
    stopProcess(proc);
  }
}

function setBuilder(): void {
  if (BUILDER === 'tsc') return;
  const path = join(APP_DIR, 'nest-cli.json');
  const nestCli = JSON.parse(readFileSync(path, 'utf-8')) as {
    compilerOptions?: Record<string, unknown>;
  };
  nestCli.compilerOptions = { ...nestCli.compilerOptions, builder: BUILDER };
  writeFileSync(path, JSON.stringify(nestCli, null, 2));
}

/**
 * `pnpm start:dev` with the production build still in dist/, as after
 * `pnpm build`: the runner must start from the fresh compile, and a view
 * edit must reach the next server render.
 */
async function verifyDevAfterBuild(): Promise<void> {
  const logs: string[] = [];
  const proc = spawn('pnpm', ['start:dev'], {
    cwd: APP_DIR,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(NEST_PORT), FORCE_COLOR: '0' },
  });
  proc.stdout?.on('data', (chunk) => logs.push(chunk.toString()));
  proc.stderr?.on('data', (chunk) => logs.push(chunk.toString()));
  const output = () => logs.join('');
  const html = async () => {
    try {
      const response = await fetch(`http://localhost:${NEST_PORT}`);
      return response.ok ? await response.text() : '';
    } catch {
      return '';
    }
  };
  const waitFor = async (check: () => Promise<boolean>, what: string) => {
    const started = Date.now();
    while (Date.now() - started < 90_000) {
      if (proc.exitCode !== null) {
        throw new Error(
          `start:dev exited while waiting for ${what}.\n${output()}`,
        );
      }
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Timed out waiting for ${what}.\n${output()}`);
  };

  try {
    await waitFor(
      async () => (await html()).includes('CLI init smoke works'),
      'the dev server',
    );
    if (/ERR_MODULE_NOT_FOUND|Cannot find module/.test(output())) {
      throw new Error(
        `The dev runner started a half-written build before the fresh one.\n${output()}`,
      );
    }

    const view = join(APP_DIR, 'src/views/home.tsx');
    const before = output().length;
    writeFileSync(
      view,
      readFileSync(view, 'utf-8').replace('Increment', 'Increment (edited)'),
    );
    await waitFor(
      async () => (await html()).includes('Increment (edited)'),
      'the view edit in a server render',
    );
    // webpack bundles views into main.js, so only there does an edit
    // restart Nest.
    const expected =
      BUILDER === 'webpack'
        ? 'Restarting Nest'
        : 'View updated without restarting Nest';
    await waitFor(
      async () => output().slice(before).includes(expected),
      `"${expected}"`,
    );
  } finally {
    stopProcess(proc);
  }
}

async function main(): Promise<void> {
  mkdirSync(FIXTURES_DIR, { recursive: true });
  cleanFixture();
  const rootLockfileBefore = readRootLockfile();
  let scenarioError: unknown;

  try {
    run('pnpm', ['build'], { cwd: PACKAGE_ROOT });
    run('pnpm', ['pack', '--pack-destination', FIXTURES_DIR], {
      cwd: PACKAGE_ROOT,
    });
    const tarballPath = findPackedTarball();

    run(
      process.execPath,
      [
        NEST_CLI,
        'new',
        APP_NAME,
        '--collection',
        NEST_SCHEMATICS,
        '--package-manager',
        'pnpm',
        '--skip-git',
        '--skip-install',
      ],
      { cwd: FIXTURES_DIR },
    );
    const scaffolded = (
      JSON.parse(readFileSync(join(APP_DIR, 'package.json'), 'utf-8')) as {
        dependencies: Record<string, string>;
      }
    ).dependencies['@nestjs/core'];
    if (!scaffolded?.replace(/^\D*/, '').startsWith(`${NEST_MAJOR}.`)) {
      throw new Error(
        `Asked for a Nest ${NEST_MAJOR} app, got @nestjs/core ${scaffolded}`,
      );
    }
    writeFileSync(
      join(APP_DIR, 'pnpm-workspace.yaml'),
      `packages:\n  - .\n${NEST_ALLOW_BUILDS}`,
    );

    run('pnpm', ['install'], { cwd: APP_DIR });
    setBuilder();
    if (BUILDER === 'swc') {
      run('pnpm', ['add', '-D', '@swc/cli', '@swc/core'], { cwd: APP_DIR });
    }
    run('pnpm', ['add', tarballPath], { cwd: APP_DIR });
    // init's own install, as a user runs it: it must succeed on the current
    // pnpm and exit non-zero if it does not.
    run('pnpm', ['exec', 'nestjs-ssr', '--port', String(VITE_PORT)], {
      cwd: APP_DIR,
    });

    assertInitOutput();
    // The app's own checks, before the smoke page replaces its controller:
    // init promises to leave them working.
    run('pnpm', ['exec', 'tsc', '--noEmit', '-p', 'tsconfig.json'], {
      cwd: APP_DIR,
    });
    run('pnpm', ['test'], { cwd: APP_DIR });
    writeSmokePage();
    run('pnpm', ['build'], { cwd: APP_DIR });
    await verifyRunningApp();
    await verifyDevAfterBuild();
  } catch (error) {
    scenarioError = error;
  } finally {
    if (!KEEP_FIXTURE) {
      cleanFixture();
    }
  }

  if (readRootLockfile() !== rootLockfileBefore) {
    throw new Error(
      'CLI init smoke test mutated the root pnpm-lock.yaml. ' +
        'The generated fixture must stay isolated from the monorepo workspace.',
    );
  }

  if (scenarioError) {
    throw scenarioError;
  }

  console.log(`CLI init smoke test passed (Nest ${NEST_MAJOR}, ${BUILDER})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
