import { defineConfig, devices } from '@playwright/test';
import { join } from 'path';

/**
 * Browser checks against examples/minimal itself (not generated fixtures):
 * client performance on the production build, and the development loop.
 *
 *   EXAMPLE_MODE=prod  pnpm test:example   (builds the example first)
 *   EXAMPLE_MODE=dev   pnpm test:example
 */
const mode = process.env.EXAMPLE_MODE === 'dev' ? 'dev' : 'prod';
const EXAMPLE = join(__dirname, '../../../../examples/minimal');
const PORT = Number(process.env.EXAMPLE_PORT ?? 3107);

export default defineConfig({
  testDir: '.',
  testMatch: mode === 'prod' ? 'client-perf.spec.ts' : 'dev-loop.spec.ts',
  // The dev loop edits files and both read shared servers: one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 90_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
  },
  // The dev loop spec starts its own servers so it can read their output.
  webServer:
    mode === 'prod'
      ? {
          command: 'pnpm build && node dist/main.js',
          cwd: EXAMPLE,
          url: `http://localhost:${PORT}/`,
          env: { NODE_ENV: 'production', PORT: String(PORT) },
          timeout: 120_000,
          reuseExistingServer: false,
        }
      : undefined,
});
