import { defineConfig, devices } from '@playwright/test';
import { PORT_CONFIG, FIXTURE_NAMES, type TestMode } from './setup/port-config';

const mode = (process.env.TEST_MODE || 'dev') as TestMode;
const ports = PORT_CONFIG[mode];

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 4,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60000,

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: FIXTURE_NAMES.map((name) => ({
    name: mode === 'prod' ? `${name}-prod` : name,
    use: {
      ...devices['Desktop Chrome'],
      baseURL: `http://localhost:${ports[name].nest}`,
    },
  })),

  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),
});
