/**
 * End-to-end SSR throughput for the example application.
 *
 * The pipeline micro-bench (`pnpm bench`) measures the cost the pipeline adds
 * around a mocked renderer. This measures what a user sees: a production
 * build of examples/minimal, served by a real NestJS process, under load.
 *
 * Absolute requests per second depend on the machine, so the gate is a ratio.
 * The JSON representation of `/recipes` carries the same data through the
 * same controller, interceptor and adapter, without React or the HTML
 * template. SSR throughput divided by JSON throughput on the same machine is
 * therefore the share of capacity the rendering path keeps, and runner
 * variance cancels out of it.
 *
 *   pnpm perf:http              measure and check against baseline.json
 *   pnpm perf:http --update     measure and re-record baseline.json
 *   pnpm perf:http --no-build   reuse an existing examples/minimal build
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

const DURATION_S = Number(process.env.PERF_DURATION ?? 10);
const CONNECTIONS = Number(process.env.PERF_CONNECTIONS ?? 50);

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
}

interface HttpBaseline {
  recordedAt: string;
  node: string;
  machine: string;
  durationSeconds: number;
  connections: number;
  measurements: Record<string, Measurement>;
  /** SSR /recipes req/s divided by JSON /recipes req/s. */
  ssrToJsonRatio: number;
  /** The ratio a run must reach. Raised as performance work lands. */
  minimumRatio: number;
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

async function measure(baseUrl: string, target: Target): Promise<Measurement> {
  const url = `${baseUrl}${target.path}`;
  // A short warm-up so JIT tiering and template/manifest caches settle
  // before anything is recorded.
  await autocannon({
    url,
    headers: target.headers,
    connections: 10,
    duration: 2,
  });
  const result = await autocannon({
    url,
    headers: target.headers,
    connections: CONNECTIONS,
    duration: DURATION_S,
  });
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
  };
}

async function main(): Promise<void> {
  const update = process.argv.includes('--update');

  if (!process.argv.includes('--no-build')) {
    console.log('Building examples/minimal for production...');
    execFileSync('pnpm', ['build'], { cwd: EXAMPLE_DIR, stdio: 'ignore' });
  }

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['dist/main'], {
    cwd: EXAMPLE_DIR,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
    stdio: 'ignore',
  });

  const measurements: Record<string, Measurement> = {};
  try {
    await waitForServer(`${baseUrl}/`, server);
    for (const target of TARGETS) {
      const m = await measure(baseUrl, target);
      measurements[target.label] = m;
      console.log(
        `  ${target.label.padEnd(16)} ${String(m.requestsPerSecond).padStart(7)} req/s` +
          `  p50 ${m.p50Ms}ms  p99 ${m.p99Ms}ms  ${m.bytesPerResponse} B`,
      );
    }
  } finally {
    server.kill('SIGTERM');
  }

  const ratio =
    measurements['ssr /recipes'].requestsPerSecond /
    measurements['json /recipes'].requestsPerSecond;
  console.log(`\n  SSR/JSON ratio for /recipes: ${ratio.toFixed(2)}`);

  const file = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as BaselineFile;

  if (update) {
    file.http = {
      recordedAt: new Date().toISOString(),
      node: process.version,
      machine: `${cpus()[0]?.model ?? 'unknown'} x${cpus().length}`,
      durationSeconds: DURATION_S,
      connections: CONNECTIONS,
      measurements,
      ssrToJsonRatio: Number(ratio.toFixed(3)),
      minimumRatio: file.http?.minimumRatio ?? 0.4,
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(file, null, 2)}\n`);
    console.log(`\nRecorded to ${BASELINE_PATH}.`);
    return;
  }

  const minimum = file.http?.minimumRatio;
  if (minimum === undefined) {
    console.log('\nNo HTTP baseline recorded yet. Run with --update.');
    return;
  }
  if (ratio < minimum) {
    console.error(
      `\nSSR/JSON ratio ${ratio.toFixed(2)} is below the required ${minimum}.`,
    );
    process.exit(1);
  }
  console.log(`\nWithin budget (minimum ratio ${minimum}).`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
