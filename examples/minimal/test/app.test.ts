/**
 * The production build of this example, served by a real NestJS process.
 * Run `pnpm build` first (`pnpm test` does).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('no port')),
      );
    });
  });
}

let server: ChildProcess;
let base: string;

beforeAll(async () => {
  if (!existsSync(join(ROOT, 'dist/main.js'))) {
    throw new Error('No build found: run `pnpm build` first.');
  }
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['dist/main.js'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
    stdio: 'ignore',
  });
  const deadline = Date.now() + 20_000;
  for (;;) {
    try {
      if ((await fetch(`${base}/`)).ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) throw new Error('server did not start');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}, 30_000);

afterAll(() => {
  server?.kill('SIGTERM');
});

const html = async (path: string) => {
  const response = await fetch(`${base}${path}`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/html');
  return response.text();
};

/** Manifest file of a view, as the client build emitted it. */
const chunkOf = (source: string): string => {
  const manifest = JSON.parse(
    readFileSync(join(ROOT, 'dist/client/.vite/manifest.json'), 'utf-8'),
  ) as Record<string, { file: string }>;
  return manifest[source].file;
};

describe('the production example', () => {
  it('renders the home page and names it for hydration', async () => {
    const page = await html('/');
    expect(page).toContain('<div id="root">');
    expect(page).toContain('window.__COMPONENT_NAME__ = "Home"');
  });

  it("preloads the page's own view chunk and no other page's", async () => {
    const page = await html('/recipes');
    expect(page).toContain(
      `rel="modulepreload" crossorigin href="/${chunkOf('src/views/recipe-list.tsx')}"`,
    );
    expect(page).not.toContain(chunkOf('src/views/home.tsx'));
  });

  it('preloads a view whose file is not named after its component', async () => {
    // SpecialsList lives in specials/views/recipe-list.tsx; the Vite
    // plugin's name index is what connects the two.
    const page = await html('/specials');
    expect(page).toContain('window.__COMPONENT_NAME__ = "SpecialsList"');
    expect(page).toContain(chunkOf('src/specials/views/recipe-list.tsx'));
  });

  it('answers the same route as JSON when asked for JSON', async () => {
    const response = await fetch(`${base}/recipes`, {
      headers: { accept: 'application/json' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toBeTruthy();
  });

  it('serves the built client assets', async () => {
    const entry = chunkOf('src/views/entry-client.tsx');
    const response = await fetch(`${base}/${entry}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('javascript');
  });
});
