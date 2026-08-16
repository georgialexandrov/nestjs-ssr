import { spawn, execSync } from 'child_process';
import { join } from 'path';
import { appendFileSync, writeFileSync } from 'fs';
import {
  getFixturesForMode,
  type FixtureConfig,
  type TestMode,
} from './setup/port-config';

const FIXTURES_DIR = join(__dirname, 'fixtures');
const PROCESS_FILE = join(__dirname, '.test-processes.json');
const SERVER_STDERR_FILE = join(__dirname, '.test-server-stderr.log');

interface ProcessInfo {
  pid: number;
  name: string;
  type: 'nest' | 'vite';
}

function monitorServerProcess(
  child: ReturnType<typeof spawn>,
  name: string,
): void {
  child.stderr?.on('data', (data) => {
    const message = String(data);
    appendFileSync(SERVER_STDERR_FILE, `[${name}] ${message}`);
    console.error(`   [${name}] stderr: ${message}`);
  });
  child.on('error', (error) => {
    appendFileSync(SERVER_STDERR_FILE, `[${name}] process error: ${error}\n`);
  });
  child.on('exit', (code) => {
    // pnpm commonly reports the intentional SIGTERM from global teardown as
    // 128 + SIGTERM (143). Any other non-zero exit is unexpected.
    if (code !== null && code !== 0 && code !== 143) {
      appendFileSync(
        SERVER_STDERR_FILE,
        `[${name}] process exited with code ${code}\n`,
      );
    }
  });
}

async function waitForServer(port: number, timeout = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}`);
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server on port ${port} did not start within ${timeout}ms`);
}

async function buildFixture(config: FixtureConfig): Promise<void> {
  const fixturePath = join(FIXTURES_DIR, config.name);
  console.log(`   Building ${config.name}...`);
  // Use pnpm build which runs: nest build && build:client && build:server
  execSync('pnpm build', { cwd: fixturePath, stdio: 'pipe' });
  console.log(`   ✓ Built ${config.name}`);
}

async function startFixtureDev(config: FixtureConfig): Promise<ProcessInfo[]> {
  const fixturePath = join(FIXTURES_DIR, config.name);
  const processes: ProcessInfo[] = [];

  // Start Vite first, then NestJS
  console.log(
    `   Starting Vite for ${config.name} on port ${config.vitePort}...`,
  );
  const viteProc = spawn('pnpm', ['dev:vite'], {
    cwd: fixturePath,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' },
    detached: true,
  });
  monitorServerProcess(viteProc, `${config.name}:vite`);

  if (viteProc.pid) {
    processes.push({ pid: viteProc.pid, name: config.name, type: 'vite' });
  }

  // Wait for Vite to be ready
  await waitForServer(config.vitePort!);
  console.log(`   ✓ Vite ready for ${config.name}`);

  // Start NestJS (without --watch to avoid restarts during test runs)
  console.log(
    `   Starting NestJS for ${config.name} on port ${config.nestPort}...`,
  );
  const nestProc = spawn('npx', ['nest', 'start'], {
    cwd: fixturePath,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' },
    detached: true,
  });
  monitorServerProcess(nestProc, `${config.name}:nest`);

  if (nestProc.pid) {
    processes.push({ pid: nestProc.pid, name: config.name, type: 'nest' });
  }

  // Wait for NestJS to be ready
  await waitForServer(config.nestPort);
  console.log(`   ✓ NestJS ready for ${config.name}`);

  return processes;
}

async function startFixtureProd(config: FixtureConfig): Promise<ProcessInfo[]> {
  const fixturePath = join(FIXTURES_DIR, config.name);
  const processes: ProcessInfo[] = [];

  // Start NestJS in production mode
  console.log(
    `   Starting NestJS (prod) for ${config.name} on port ${config.nestPort}...`,
  );
  // Use dist/src/main.js directly (nest build outputs to dist/src/)
  const nestProc = spawn('node', ['dist/src/main.js'], {
    cwd: fixturePath,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(config.nestPort),
    },
    detached: true,
  });
  monitorServerProcess(nestProc, `${config.name}:nest`);

  if (nestProc.pid) {
    processes.push({ pid: nestProc.pid, name: config.name, type: 'nest' });
  }

  // Wait for NestJS to be ready
  await waitForServer(config.nestPort);
  console.log(`   ✓ NestJS (prod) ready for ${config.name}`);

  return processes;
}

async function globalSetup() {
  const mode = (process.env.TEST_MODE || 'dev') as TestMode;
  const fixtures = getFixturesForMode(mode);
  writeFileSync(SERVER_STDERR_FILE, '');

  console.log(`\n🚀 Starting test servers (${mode} mode)...\n`);

  // For prod mode, build all fixtures first
  if (mode === 'prod') {
    console.log('📦 Building fixtures...\n');
    await Promise.all(fixtures.map((config) => buildFixture(config)));
    console.log('\n✓ All fixtures built\n');
  }

  const allProcesses: ProcessInfo[] = [];
  const startFn = mode === 'prod' ? startFixtureProd : startFixtureDev;

  if (mode === 'prod') {
    // Start production servers sequentially to avoid Vite initialization conflicts
    for (const config of fixtures) {
      try {
        const procs = await startFn(config);
        allProcesses.push(...procs);
      } catch (error) {
        console.error(`   ❌ Failed to start ${config.name}:`, error);
      }
    }
  } else {
    // Start dev servers in parallel
    const results = await Promise.all(
      fixtures.map(async (config) => {
        try {
          return await startFn(config);
        } catch (error) {
          console.error(`   ❌ Failed to start ${config.name}:`, error);
          return [];
        }
      }),
    );

    for (const procs of results) {
      allProcesses.push(...procs);
    }
  }

  // Save process IDs for teardown
  writeFileSync(PROCESS_FILE, JSON.stringify(allProcesses, null, 2));

  console.log('\n✅ All servers started!\n');
}

export default globalSetup;
