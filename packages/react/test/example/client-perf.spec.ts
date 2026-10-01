/**
 * Client performance of the production example.
 *
 * - A page loads its own view's code and no other page's (route splitting).
 * - Hydration starts no later than the recorded baseline allows. Timing is
 *   compared only on the machine that recorded it (see test/perf/baseline.json);
 *   elsewhere it is reported. Run with CLIENT_PERF_UPDATE=1 to re-record.
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { cpus } from 'os';
import { join } from 'path';

const EXAMPLE = join(__dirname, '../../../../examples/minimal');
const BASELINE = join(__dirname, '../perf/baseline.json');
const RUNS = 5;
const TOLERANCE = 1.1;

const manifest = () =>
  JSON.parse(
    readFileSync(join(EXAMPLE, 'dist/client/.vite/manifest.json'), 'utf-8'),
  ) as Record<string, { file: string }>;

/** Chunks of each page view, by route. */
const ROUTES: Record<string, string> = {
  '/': 'src/views/home.tsx',
  '/recipes': 'src/views/recipe-list.tsx',
  '/chefs/mikko': 'src/views/chef-profile.tsx',
  '/recipes/lohikeitto': 'src/views/recipe-detail.tsx',
  '/specials': 'src/specials/views/recipe-list.tsx',
};

/** JavaScript files requested until hydration has started. */
async function scriptsBeforeHydration(page: Page, path: string) {
  const requested: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') {
      requested.push(new URL(request.url()).pathname.slice(1));
    }
  });
  await page.goto(path);
  await page.waitForFunction(
    () => performance.getEntriesByName('nestjs-ssr:hydrate').length > 0,
  );
  return requested;
}

for (const [route, view] of Object.entries(ROUTES)) {
  test(`${route} loads its own view and no other page's`, async ({ page }) => {
    const files = manifest();
    const requested = await scriptsBeforeHydration(page, route);
    expect(requested).toContain(files[view].file);
    for (const [other, otherView] of Object.entries(ROUTES)) {
      if (other === route || otherView === view) continue;
      expect(requested, `${route} requested ${other}'s view`).not.toContain(
        files[otherView].file,
      );
    }
  });
}

test('hydration starts within the recorded budget', async ({ browser }) => {
  const samples: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/recipes');
    await page.waitForFunction(
      () => performance.getEntriesByName('nestjs-ssr:hydrate').length > 0,
    );
    samples.push(
      await page.evaluate(
        () => performance.getEntriesByName('nestjs-ssr:hydrate')[0].startTime,
      ),
    );
    await context.close();
  }
  const median = [...samples].sort((a, b) => a - b)[Math.floor(RUNS / 2)];
  const machine = `${cpus()[0]?.model.trim()} x${cpus().length}`;
  console.log(`hydration start on /recipes: median ${median.toFixed(1)} ms`);

  const file = JSON.parse(readFileSync(BASELINE, 'utf-8')) as {
    client?: { machine: string; hydrationStartMs: number };
  };
  if (process.env.CLIENT_PERF_UPDATE) {
    file.client = {
      machine,
      hydrationStartMs: Math.round(median * 10) / 10,
    };
    writeFileSync(BASELINE, `${JSON.stringify(file, null, 2)}\n`);
    return;
  }
  if (!file.client || file.client.machine !== machine) {
    console.log('Hydration budget not checked: no baseline for this machine.');
    return;
  }
  expect(median).toBeLessThanOrEqual(file.client.hydrationStartMs * TOLERANCE);
});
