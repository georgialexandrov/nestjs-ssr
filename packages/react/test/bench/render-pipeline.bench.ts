/**
 * Overhead budget for the rendered-response pipeline.
 *
 * React's own render dominates end-to-end latency and this change does not
 * touch it. What this measures is the cost the pipeline *adds* around it —
 * negotiation, projection and validation, response policy — plus the two
 * things a resource boundary must not do: leak per-request handles, or grow
 * the payload.
 *
 * Run with `pnpm bench`. Numbers are compared against `baseline.json`; a
 * regression past the recorded ceiling fails the run, so the budget is a gate
 * rather than a report nobody reads.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Reflector } from '@nestjs/core';
import { of, firstValueFrom } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { RenderInterceptor } from '../../src/render/render.interceptor';
import type { RenderService } from '../../src/render/render.service';
import {
  RENDER_KEY,
  RENDER_OPTIONS_KEY,
} from '../../src/decorators/react-render.decorator';
import {
  api,
  page,
  representations,
} from '../../src/interfaces/representation.interface';
import { resolveModulePolicy } from '../../src/render/pipeline/representation-policy';
import { RenderScope } from '../../src/render/pipeline/render-scope';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(HERE, 'baseline.json');

const ITERATIONS = 2000;
const WARMUP = 200;

interface Measurement {
  /** Median wall time of one pipeline pass, in microseconds. */
  medianUs: number;
  /** 95th percentile, in microseconds. */
  p95Us: number;
  /** Bytes of response body produced. */
  bytes: number;
}

interface Baseline {
  recordedAt: string;
  node: string;
  /** Ratio a measurement may exceed its baseline before the run fails. */
  tolerance: number;
  measurements: Record<string, Measurement>;
  handles: { scopesCreated: number; listenersLeft: number };
}

const Component = () => null;
Component.displayName = 'BenchPage';

const props = {
  recipes: Array.from({ length: 50 }, (_, i) => ({
    slug: `recipe-${i}`,
    name: `Recipe ${i}`,
    description: 'A description long enough to be representative of real data.',
    ingredients: Array.from({ length: 10 }, (_, j) => ({
      amount: `${j}`,
      item: `ingredient ${j}`,
    })),
  })),
};

function createHarness(mode: 'string' | 'stream') {
  const reflector = {
    get: (key: unknown) => {
      if (key === RENDER_KEY) return Component;
      if (key === RENDER_OPTIONS_KEY) return undefined;
      return undefined;
    },
  } as unknown as Reflector;

  // Stream mode resolves with undefined after writing the response itself;
  // string mode resolves with the HTML. Both are stubbed so the measurement
  // is the pipeline around the renderer, not React.
  const html = '<html><body>rendered</body></html>';
  const renderService = {
    render: () => Promise.resolve(mode === 'stream' ? undefined : html),
    renderSegment: () =>
      Promise.resolve({ v: 1, html, props, swapTarget: 'RootLayout' }),
    getRootLayout: () => Promise.resolve(null),
  } as unknown as RenderService;

  const interceptor = new RenderInterceptor(
    reflector,
    renderService,
    ['accept-language'],
    ['theme'],
    undefined,
    undefined,
    undefined,
    undefined,
    resolveModulePolicy({ policy: { json: true } }),
  );

  return { interceptor, html };
}

function createContext(headers: Record<string, string>): ExecutionContext {
  const store = new Map<string, string>();
  const response = {
    headersSent: false,
    getHeader: (name: string) => store.get(name.toLowerCase()),
    setHeader: (name: string, value: string) =>
      store.set(name.toLowerCase(), value),
    header: (name: string, value: string) =>
      store.set(name.toLowerCase(), value),
    type: (value: string) => store.set('content-type', value),
  };

  return {
    getHandler: () => Component,
    getClass: () => ({ name: 'BenchController' }),
    switchToHttp: () => ({
      getRequest: () => ({
        url: '/recipes',
        path: '/recipes',
        method: 'GET',
        query: {},
        params: {},
        headers,
        cookies: { theme: 'dark' },
      }),
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index];
}

async function measure(
  label: string,
  run: () => Promise<unknown>,
): Promise<Measurement> {
  for (let i = 0; i < WARMUP; i++) await run();

  const samples: number[] = new Array(ITERATIONS);
  let lastResult: unknown;
  for (let i = 0; i < ITERATIONS; i++) {
    const start = process.hrtime.bigint();
    lastResult = await run();
    samples[i] = Number(process.hrtime.bigint() - start) / 1000;
  }

  samples.sort((a, b) => a - b);
  const bytes = Buffer.byteLength(
    typeof lastResult === 'string'
      ? lastResult
      : JSON.stringify(lastResult ?? ''),
    'utf8',
  );

  const measurement: Measurement = {
    medianUs: Number(percentile(samples, 0.5).toFixed(2)),
    p95Us: Number(percentile(samples, 0.95).toFixed(2)),
    bytes,
  };

  console.log(
    `  ${label.padEnd(24)} median ${measurement.medianUs.toFixed(2)}µs  p95 ${measurement.p95Us.toFixed(2)}µs  ${measurement.bytes} bytes`,
  );
  return measurement;
}

function handler(data: unknown): CallHandler {
  return { handle: () => of(data) } as CallHandler;
}

/**
 * A render scope registers a timer and request listeners. Creating and
 * disposing many of them must leave nothing behind, or a busy server
 * accumulates handles until it dies.
 */
function measureHandles(): { scopesCreated: number; listenersLeft: number } {
  const request = new (
    require('events').EventEmitter as {
      new (): { listenerCount(event: string): number };
    }
  )();

  const scopes = 5000;
  for (let i = 0; i < scopes; i++) {
    const scope = new RenderScope({
      deadlineMs: 10_000,
      request: request as never,
    });
    scope.dispose();
  }

  return {
    scopesCreated: scopes,
    listenersLeft: request.listenerCount('close'),
  };
}

async function main(): Promise<void> {
  const update = process.argv.includes('--update');
  const measurements: Record<string, Measurement> = {};

  for (const mode of ['string', 'stream'] as const) {
    console.log(`\n${mode} mode`);
    const { interceptor } = createHarness(mode);

    measurements[`${mode}:html`] = await measure('html (plain props)', () =>
      firstValueFrom(
        interceptor.intercept(
          createContext({ accept: 'text/html' }),
          handler(props),
        ),
      ),
    );

    measurements[`${mode}:html-representations`] = await measure(
      'html (representations)',
      () =>
        firstValueFrom(
          interceptor.intercept(
            createContext({ accept: 'text/html' }),
            handler(
              representations({
                html: page({ props }),
                json: api(() => ({ total: props.recipes.length })),
              }),
            ),
          ),
        ),
    );

    measurements[`${mode}:json`] = await measure('json', () =>
      firstValueFrom(
        interceptor.intercept(
          createContext({ accept: 'application/json' }),
          handler(
            representations({
              html: page({ props }),
              json: api({ total: props.recipes.length }),
            }),
          ),
        ),
      ),
    );

    measurements[`${mode}:segment`] = await measure('segment', () =>
      firstValueFrom(
        interceptor.intercept(
          createContext({
            accept: 'text/html',
            'x-current-layouts': 'RootLayout',
          }),
          handler(props),
        ),
      ),
    );
  }

  console.log('\nhandles');
  const handles = measureHandles();
  console.log(
    `  ${String(handles.scopesCreated).padEnd(6)} scopes created and disposed, ${handles.listenersLeft} listeners left`,
  );

  const result: Baseline = {
    recordedAt: new Date().toISOString(),
    node: process.version,
    tolerance: 2.5,
    measurements,
    handles,
  };

  if (update) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`\nBaseline written to ${BASELINE_PATH}`);
    return;
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline;
  const failures: string[] = [];

  if (handles.listenersLeft > baseline.handles.listenersLeft) {
    failures.push(
      `render scopes leaked ${handles.listenersLeft} listeners (baseline ${baseline.handles.listenersLeft})`,
    );
  }

  for (const [label, current] of Object.entries(measurements)) {
    const recorded = baseline.measurements[label];
    if (!recorded) {
      console.log(`\nNew measurement "${label}" is not in the baseline yet.`);
      continue;
    }

    const ceiling = recorded.p95Us * baseline.tolerance;
    if (current.p95Us > ceiling) {
      failures.push(
        `${label}: p95 ${current.p95Us}µs exceeds ${ceiling.toFixed(2)}µs (baseline ${recorded.p95Us}µs x${baseline.tolerance})`,
      );
    }

    // Payload size is deterministic; any growth is a real change in what the
    // pipeline emits, so it is held exactly rather than to a ratio.
    if (current.bytes > recorded.bytes) {
      failures.push(
        `${label}: response grew to ${current.bytes} bytes (baseline ${recorded.bytes})`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('\nBenchmark regressions:');
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error(
      '\nIf the change is intentional, re-record with `pnpm bench --update`.',
    );
    process.exit(1);
  }

  console.log('\nWithin the recorded budget.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
