import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  concurrentlyScript,
  detectPackageManager,
  runScriptCommand,
} from '../init-project-context';

describe('detectPackageManager', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pm-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('prefers an explicit choice', () => {
    writeFileSync(join(dir, 'pnpm-lock.yaml'), '');
    expect(detectPackageManager(dir, 'yarn', '')).toBe('yarn');
  });

  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['package-lock.json', 'npm'],
  ])('reads %s', (lockfile, manager) => {
    writeFileSync(join(dir, lockfile), '');
    expect(detectPackageManager(dir, undefined, '')).toBe(manager);
  });

  it("finds a monorepo root's lockfile above the project", () => {
    writeFileSync(join(dir, 'yarn.lock'), '');
    mkdirSync(join(dir, 'apps', 'web'), { recursive: true });
    expect(detectPackageManager(join(dir, 'apps', 'web'), undefined, '')).toBe(
      'yarn',
    );
  });

  it('falls back to the invoking manager, then npm', () => {
    expect(
      detectPackageManager(dir, undefined, 'pnpm/12.6.0 npm/? node/v26'),
    ).toBe('pnpm');
    expect(detectPackageManager(dir, undefined, '')).toBe('npm');
  });
});

describe('script commands', () => {
  it('runs scripts the way each manager expects', () => {
    expect(runScriptCommand('pnpm', 'build:client')).toBe('pnpm build:client');
    expect(runScriptCommand('yarn', 'build:client')).toBe('yarn build:client');
    expect(runScriptCommand('npm', 'build:client')).toBe(
      'npm run build:client',
    );
    expect(runScriptCommand('bun', 'build:client')).toBe(
      'bun run build:client',
    );
    expect(concurrentlyScript('npm', 'dev:vite')).toBe('"npm:dev:vite"');
  });
});
