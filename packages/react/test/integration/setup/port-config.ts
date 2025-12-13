export type TestMode = 'dev' | 'prod';

export const PORT_CONFIG = {
  dev: {
    'embedded-string': { nest: 3001, vite: null },
    'embedded-stream': { nest: 3002, vite: null },
    'proxy-string': { nest: 3003, vite: 5173 },
    'proxy-stream': { nest: 3004, vite: 5174 },
  },
  prod: {
    'embedded-string': { nest: 3011, vite: null },
    'embedded-stream': { nest: 3012, vite: null },
    'proxy-string': { nest: 3013, vite: null }, // No vite in prod
    'proxy-stream': { nest: 3014, vite: null }, // No vite in prod
  },
} as const;

export type FixtureName = keyof typeof PORT_CONFIG.dev;
export const FIXTURE_NAMES = Object.keys(PORT_CONFIG.dev) as FixtureName[];

export interface FixtureConfig {
  name: FixtureName;
  viteMode: 'embedded' | 'proxy';
  ssrMode: 'string' | 'stream';
  nestPort: number;
  vitePort: number | null;
}

export const FIXTURES: FixtureConfig[] = [
  {
    name: 'embedded-string',
    viteMode: 'embedded',
    ssrMode: 'string',
    nestPort: 3001,
    vitePort: null,
  },
  {
    name: 'embedded-stream',
    viteMode: 'embedded',
    ssrMode: 'stream',
    nestPort: 3002,
    vitePort: null,
  },
  {
    name: 'proxy-string',
    viteMode: 'proxy',
    ssrMode: 'string',
    nestPort: 3003,
    vitePort: 5173,
  },
  {
    name: 'proxy-stream',
    viteMode: 'proxy',
    ssrMode: 'stream',
    nestPort: 3004,
    vitePort: 5174,
  },
];

export function getFixturesForMode(mode: TestMode): FixtureConfig[] {
  const ports = PORT_CONFIG[mode];
  return FIXTURE_NAMES.map((name) => ({
    name,
    viteMode: name.startsWith('proxy-') ? 'proxy' : 'embedded',
    ssrMode: name.endsWith('-stream') ? 'stream' : 'string',
    nestPort: ports[name].nest,
    vitePort: ports[name].vite,
  })) as FixtureConfig[];
}
