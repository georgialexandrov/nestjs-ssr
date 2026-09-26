import { describe, expect, it } from 'vitest';
import { isViewOutput, needsRestart } from '../dev';

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
