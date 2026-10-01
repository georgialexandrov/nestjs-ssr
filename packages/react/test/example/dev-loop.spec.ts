/**
 * The development loop of the example, as `pnpm start:dev` runs it (Vite plus
 * `nestjs-ssr dev`):
 *
 * - editing a view updates the open page through Vite within 2 s, the next
 *   server render includes the edit, and Nest is not restarted;
 * - editing a service restarts Nest.
 *
 * The restart decision is read from the runner's own output, the signal a
 * developer sees. Edited files are restored afterwards.
 */
import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const EXAMPLE = join(__dirname, '../../../../examples/minimal');
const PORT = Number(process.env.EXAMPLE_PORT ?? 3107);
// Not the example's default, so a developer's own `pnpm start:dev` of the
// example can keep running.
const VITE_PORT = Number(process.env.EXAMPLE_VITE_PORT ?? 5198);
const VIEW = join(EXAMPLE, 'src/views/recipe-list.tsx');
const SERVICE = join(EXAMPLE, 'src/recipes.service.ts');
const UPDATE_BUDGET_MS = 2000;

let dev: ChildProcess;
let output = '';
const originals = new Map<string, string>();

function edit(file: string, change: (source: string) => string) {
  if (!originals.has(file)) originals.set(file, readFileSync(file, 'utf-8'));
  writeFileSync(file, change(readFileSync(file, 'utf-8')));
}

function restore() {
  for (const [file, source] of originals) writeFileSync(file, source);
  originals.clear();
}

async function waitFor(
  check: () => boolean | Promise<boolean>,
  timeoutMs: number,
  what: string,
) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${what}. Output:\n${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const serverHtml = async (path: string) => {
  try {
    const response = await fetch(`http://localhost:${PORT}${path}`);
    return response.ok ? await response.text() : '';
  } catch {
    return '';
  }
};

test.beforeAll(async () => {
  dev = spawn('pnpm', ['start:dev'], {
    cwd: EXAMPLE,
    env: {
      ...process.env,
      PORT: String(PORT),
      VITE_PORT: String(VITE_PORT),
      FORCE_COLOR: '0',
    },
    detached: true,
  });
  dev.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  dev.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  await waitFor(
    async () => (await serverHtml('/recipes')).includes('All Recipes'),
    90_000,
    'the dev servers',
  );
});

test.afterAll(() => {
  restore();
  if (dev?.pid) {
    try {
      process.kill(-dev.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
});

test('a view edit updates the page and server rendering without restarting Nest', async ({
  page,
}) => {
  await page.goto('/recipes');
  await page.waitForFunction(
    () => performance.getEntriesByName('nestjs-ssr:hydrate').length > 0,
  );
  const logStart = output.length;

  const started = Date.now();
  edit(VIEW, (source) =>
    source.replace("'All Recipes'", "'All Recipes (edited)'"),
  );
  await expect(
    page.getByRole('heading', { name: /All Recipes/ }),
  ).toContainText('(edited)', {
    timeout: UPDATE_BUDGET_MS,
  });
  const elapsed = Date.now() - started;
  console.log(`view edit visible in the open page after ${elapsed} ms`);

  // The next server render includes the edit, from the same Nest process.
  expect(await serverHtml('/recipes')).toContain('All Recipes (edited)');
  await waitFor(
    () =>
      output.slice(logStart).includes('View updated without restarting Nest'),
    30_000,
    'the runner to report the view update',
  );
  expect(output.slice(logStart)).not.toContain('Restarting Nest');
  restore();
});

test('a service edit restarts Nest', async () => {
  const logStart = output.length;
  // A code change: the example compiles with removeComments, so a comment
  // alone emits identical JavaScript and (correctly) restarts nothing.
  edit(
    SERVICE,
    (source) => `${source}\nexport const DEV_LOOP_PROBE = ${Date.now()};\n`,
  );
  await waitFor(
    () => output.slice(logStart).includes('Restarting Nest'),
    30_000,
    'the runner to restart Nest',
  );
  restore();
  await waitFor(
    async () => (await serverHtml('/recipes')).includes('All Recipes'),
    60_000,
    'Nest to come back',
  );
});
