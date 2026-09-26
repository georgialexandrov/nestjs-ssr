/**
 * End-to-end SSR cost for the example application.
 *
 * The pipeline micro-bench (`pnpm bench`) measures the cost the pipeline adds
 * around a mocked renderer. This measures what a user sees: a production
 * build of examples/minimal, served by a real NestJS process, under load.
 *
 * Two numbers are reported per route:
 * - requests per second and latency, which is what users feel but depends
 *   on everything else the machine is doing;
 * - server CPU time per request, read from inside the server process, which
 *   is far less sensitive to contention and is what the gate uses.
 *
 * The gate is a ratio. The JSON representation of `/recipes` carries the same
 * data through the same controller, interceptor and adapter, without React or
 * the HTML template. JSON CPU/request divided by SSR CPU/request is the share
 * of capacity the rendering path keeps, and machine speed cancels out of it.
 *
 *   pnpm perf:http              measure and check against baseline.json
 *   pnpm perf:http --update     measure and re-record baseline.json
 *   pnpm perf:http --no-build   reuse an existing examples/minimal build
 *   PERF_ROUNDS=3 pnpm perf:http   median of several rounds
 */
import { spawn, execFileSync, type ChildProcess } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { createServer } from 'net';
import { cpus } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import autocannon from 'autocannon';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = join(HERE, '../../../../examples/minimal');
const BASELINE_PATH = join(HERE, 'baseline.json');
const CPU_PROBE = join(HERE, 'cpu-probe.cjs');

const DURATION_S = Number(process.env.PERF_DURATION ?? 10);
const CONNECTIONS = Number(process.env.PERF_CONNECTIONS ?? 50);
const ROUNDS = Number(process.env.PERF_ROUNDS ?? 1);

interface Target {
  label: string;
  path: string;
  headers?: Record<string, string>;
}

const TARGETS: Target[] = [
  { label: 'ssr /', path: '/' },
  { label: 'ssr /recipes', path: '/recipes' },
  {
    label: 'json /recipes',
    path: '/recipes',
    headers: { accept: 'application/json' },
  },
];

interface Measurement {
  requestsPerSecond: number;
  p50Ms: number;
  p99Ms: number;
  bytesPerResponse: number;
  /** Server-process CPU time (user + system) per request, in microseconds. */
  cpuMicrosPerRequest: number;
}

interface HttpBaseline {
  recordedAt: string;
  node: string;
  machine: string;
  nest: string;
  durationSeconds: number;
  connections: number;
  measurements: Record<string, Measurement>;
  /** JSON /recipes CPU per request divided by SSR /recipes CPU per request. */
  cpuRatio: number;
  /** The ratio a run must reach. Raised as performance work lands. */
  minimumCpuRatio: number;
}

interface BaselineFile {
  http?: HttpBaseline;
  [section: string]: unknown;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('No port assigned')),
      );
    });
  });
}

async function waitForServer(url: string, server: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Example server exited with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Example server did not answer ${url} within 30s`);
}

async function serverCpuMicros(cpuPort: number): Promise<number> {
  const response = await fetch(`http://127.0.0.1:${cpuPort}/`);
  return ((await response.json()) as { micros: number }).micros;
}

async function measure(
  baseUrl: string,
  cpuPort: number,
  target: Target,
): Promise<Measurement> {
  const url = `${baseUrl}${target.path}`;
  // A short warm-up so JIT tiering and template/manifest caches settle
  // before anything is recorded.
  await autocannon({
    url,
    headers: target.headers,
    connections: 10,
    duration: 2,
  });
  const cpuBefore = await serverCpuMicros(cpuPort);
  const result = await autocannon({
    url,
    headers: target.headers,
    connections: CONNECTIONS,
    duration: DURATION_S,
  });
  const cpuAfter = await serverCpuMicros(cpuPort);
  const failures = result.errors + result.timeouts + result.non2xx;
  if (failures > 0) {
    throw new Error(`${target.label}: ${failures} failed requests`);
  }
  return {
    requestsPerSecond: Math.round(result.requests.average),
    p50Ms: result.latency.p50,
    p99Ms: result.latency.p99,
    bytesPerResponse: Math.round(
      result.throughput.total / result.requests.total,
    ),
    cpuMicrosPerRequest: Math.round(
      (cpuAfter - cpuBefore) / result.requests.total,
    ),
  };
}

async function runRound(): Promise<Record<string, Measurement>> {
  const [port, cpuPort] = [await freePort(), await freePort()];
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(
    process.execPath,
    ['--require', CPU_PROBE, 'dist/main'],
    {
      cwd: EXAMPLE_DIR,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(port),
        PERF_CPU_PORT: String(cpuPort),
      },
      stdio: 'ignore',
    },
  );

  const measurements: Record<string, Measurement> = {};
  try {
    await waitForServer(`${baseUrl}/`, server);
    for (const target of TARGETS) {
      measurements[target.label] = await measure(baseUrl, cpuPort, target);
    }
  } finally {
    server.kill('SIGTERM');
  }
  return measurements;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function main(): Promise<void> {
  const update = process.argv.includes('--update');

  if (!process.argv.includes('--no-build')) {
    console.log('Building examples/minimal for production...');
    execFileSync('pnpm', ['build'], { cwd: EXAMPLE_DIR, stdio: 'ignore' });
  }

  const rounds: Array<Record<string, Measurement>> = [];
  for (let round = 0; round < ROUNDS; round++) rounds.push(await runRound());

  const measurements: Record<string, Measurement> = {};
  for (const { label } of TARGETS) {
    const of = (key: keyof Measurement) =>
      median(rounds.map((round) => round[label][key]));
    measurements[label] = {
      requestsPerSecond: of('requestsPerSecond'),
      p50Ms: of('p50Ms'),
      p99Ms: of('p99Ms'),
      bytesPerResponse: of('bytesPerResponse'),
      cpuMicrosPerRequest: of('cpuMicrosPerRequest'),
    };
    const m = measurements[label];
    console.log(
      `  ${label.padEnd(16)} ${String(m.requestsPerSecond).padStart(7)} req/s` +
        `  p50 ${m.p50Ms}ms  p99 ${m.p99Ms}ms` +
        `  ${String(m.cpuMicrosPerRequest).padStart(5)} µs CPU/req  ${m.bytesPerResponse} B`,
    );
  }

  const cpuRatio =
    measurements['json /recipes'].cpuMicrosPerRequest /
    measurements['ssr /recipes'].cpuMicrosPerRequest;
  console.log(
    `\n  JSON/SSR CPU ratio for /recipes: ${cpuRatio.toFixed(2)}` +
      ` (share of capacity SSR keeps; 1.0 = as cheap as JSON)`,
  );

  const file = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as BaselineFile;

  if (update) {
    const nest = (
      JSON.parse(
        readFileSync(
          join(EXAMPLE_DIR, 'node_modules/@nestjs/core/package.json'),
          'utf-8',
        ),
      ) as { version: string }
    ).version;
    file.http = {
      recordedAt: new Date().toISOString(),
      node: process.version,
      machine: `${cpus()[0]?.model ?? 'unknown'} x${cpus().length}`,
      nest,
      durationSeconds: DURATION_S,
      connections: CONNECTIONS,
      measurements,
      cpuRatio: Number(cpuRatio.toFixed(3)),
      minimumCpuRatio: file.http?.minimumCpuRatio ?? 0.3,
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(file, null, 2)}\n`);
    console.log(`\nRecorded to ${BASELINE_PATH}.`);
    return;
  }

  const minimum = file.http?.minimumCpuRatio;
  if (minimum === undefined) {
    console.log('\nNo HTTP baseline recorded yet. Run with --update.');
    return;
  }
  if (cpuRatio < minimum) {
    console.error(
      `\nJSON/SSR CPU ratio ${cpuRatio.toFixed(2)} is below the required ${minimum}.`,
    );
    process.exit(1);
  }
  console.log(`\nWithin budget (minimum CPU ratio ${minimum}).`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
