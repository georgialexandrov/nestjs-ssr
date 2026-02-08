export type TestMode = 'dev' | 'prod';

export const PORT_CONFIG = {
  dev: {
    express: { nest: 3021, vite: 5181 },
    fastify: { nest: 3022, vite: 5182 },
  },
  prod: {
    express: { nest: 3031, vite: null },
    fastify: { nest: 3032, vite: null },
  },
} as const;

export type FixtureName = keyof typeof PORT_CONFIG.dev;
export const FIXTURE_NAMES = Object.keys(PORT_CONFIG.dev) as FixtureName[];

export interface FixtureConfig {
  name: FixtureName;
  adapter: 'express' | 'fastify';
  nestPort: number;
  vitePort: number | null;
}

export const FIXTURES: FixtureConfig[] = [
  {
    name: 'express',
    adapter: 'express',
    nestPort: 3021,
    vitePort: 5181,
  },
  {
    name: 'fastify',
    adapter: 'fastify',
    nestPort: 3022,
    vitePort: 5182,
  },
];

export function getFixturesForMode(mode: TestMode): FixtureConfig[] {
  const ports = PORT_CONFIG[mode];
  return FIXTURE_NAMES.map((name) => ({
    name,
    adapter: name as 'express' | 'fastify',
    nestPort: ports[name].nest,
    vitePort: ports[name].vite,
  }));
}
