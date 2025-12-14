export type TestMode = 'dev' | 'prod';

export const PORT_CONFIG = {
  dev: {
    string: { nest: 3001, vite: 5173 },
    stream: { nest: 3002, vite: 5174 },
  },
  prod: {
    string: { nest: 3011, vite: null },
    stream: { nest: 3012, vite: null },
  },
} as const;

export type FixtureName = keyof typeof PORT_CONFIG.dev;
export const FIXTURE_NAMES = Object.keys(PORT_CONFIG.dev) as FixtureName[];

export interface FixtureConfig {
  name: FixtureName;
  ssrMode: 'string' | 'stream';
  nestPort: number;
  vitePort: number | null;
}

export const FIXTURES: FixtureConfig[] = [
  {
    name: 'string',
    ssrMode: 'string',
    nestPort: 3001,
    vitePort: 5173,
  },
  {
    name: 'stream',
    ssrMode: 'stream',
    nestPort: 3002,
    vitePort: 5174,
  },
];

export function getFixturesForMode(mode: TestMode): FixtureConfig[] {
  const ports = PORT_CONFIG[mode];
  return FIXTURE_NAMES.map((name) => ({
    name,
    ssrMode: name as 'string' | 'stream',
    nestPort: ports[name].nest,
    vitePort: ports[name].vite,
  }));
}
