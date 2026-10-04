import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { isViewOutput, listOutputs, needsRestart } from '../dev';

const outputs = (entries: Record<string, string>) =>
  new Map(Object.entries(entries));

describe('nestjs-ssr dev restart decision', () => {
  const before = outputs({
    'main.js': 'a',
    'app.controller.js': 'b',
    'views/home.js': 'c',
    'products/views/list.js': 'd',
  });

  it('does not restart when only views changed', () => {
    const after = outputs({
      'main.js': 'a',
      'app.controller.js': 'b',
      'views/home.js': 'c2',
      'products/views/list.js': 'd2',
    });
    expect(needsRestart(before, after)).toEqual({
      restart: false,
      changed: ['views/home.js', 'products/views/list.js'],
    });
  });

  it('restarts when a controller, module or service changed', () => {
    const after = outputs({
      'main.js': 'a',
      'app.controller.js': 'b2',
      'views/home.js': 'c2',
      'products/views/list.js': 'd',
    });
    expect(needsRestart(before, after).restart).toBe(true);
  });

  it('ignores files re-written with identical content', () => {
    // tsc may re-emit a controller whose output did not change.
    expect(needsRestart(before, outputs(Object.fromEntries(before)))).toEqual({
      restart: false,
      changed: [],
    });
  });

  it('restarts when a non-view file appears or disappears', () => {
    const added = new Map(before).set('new.service.js', 'x');
    expect(needsRestart(before, added).restart).toBe(true);
    const removed = new Map(before);
    removed.delete('app.controller.js');
    expect(needsRestart(before, removed).restart).toBe(true);
  });

  it('treats only files inside a views directory as views', () => {
    expect(isViewOutput('views/home.js')).toBe(true);
    expect(isViewOutput('products\\views\\list.js')).toBe(true);
    expect(isViewOutput('reviews/review.service.js')).toBe(false);
    expect(isViewOutput('app.controller.js')).toBe(false);
  });
});

describe('nestjs-ssr dev output listing', () => {
  let dist: string;

  beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), 'dev-outputs-'));
    for (const file of [
      'src/main.js',
      'src/views/home.js',
      // Application modules that happen to be called server and client.
      'src/server/api.service.js',
      'src/client/http.client.js',
      // Vite's bundles, not Nest output.
      'client/assets/client-abc.js',
      'server/entry-server.mjs',
      'src/main.js.map',
      'src/main.d.ts',
    ]) {
      mkdirSync(join(dist, file, '..'), { recursive: true });
      writeFileSync(join(dist, file), file);
    }
  });

  afterEach(() => rmSync(dist, { recursive: true, force: true }));

  it('includes nested server and client modules and skips only the Vite bundles', () => {
    const files = [...listOutputs(dist).keys()]
      .map((file) => file.split('\\').join('/'))
      .sort();
    expect(files).toEqual([
      'src/client/http.client.js',
      'src/main.js',
      'src/server/api.service.js',
      'src/views/home.js',
    ]);
  });

  it('restarts when a nested server module changes', () => {
    const before = listOutputs(dist);
    writeFileSync(join(dist, 'src/server/api.service.js'), 'changed');
    expect(needsRestart(before, listOutputs(dist)).restart).toBe(true);
  });
});
