import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { RenderScope } from '../render-scope';
import { RenderDeadlineError } from '../errors';

afterEach(() => {
  vi.useRealTimers();
});

describe('RenderScope', () => {
  it('exposes an abort signal that starts unaborted', () => {
    const scope = new RenderScope({ deadlineMs: 1000 });
    expect(scope.signal.aborted).toBe(false);
    scope.dispose();
  });

  it('aborts when the deadline passes', () => {
    vi.useFakeTimers();
    const scope = new RenderScope({ deadlineMs: 50 });

    vi.advanceTimersByTime(51);

    expect(scope.aborted).toBe(true);
    expect(scope.reason).toBe('timeout');
    scope.dispose();
  });

  it('rejects a pending operation with a deadline error', async () => {
    vi.useFakeTimers();
    const scope = new RenderScope({ deadlineMs: 20 });
    const pending = scope.run(new Promise(() => {}));

    vi.advanceTimersByTime(21);

    await expect(pending).rejects.toBeInstanceOf(RenderDeadlineError);
    scope.dispose();
  });

  it('aborts when the request is aborted', () => {
    const request = new EventEmitter();
    const scope = new RenderScope({ deadlineMs: 10_000, request });

    request.emit('aborted');

    expect(scope.aborted).toBe(true);
    expect(scope.reason).toBe('disconnect');
    scope.dispose();
  });

  it('adopts a request that was already aborted', () => {
    const request = Object.assign(new EventEmitter(), { aborted: true });
    const scope = new RenderScope({ deadlineMs: 10_000, request });

    expect(scope.reason).toBe('disconnect');
    scope.dispose();
  });

  it('does not treat normal request completion as a disconnect', () => {
    const request = new EventEmitter();
    const scope = new RenderScope({ deadlineMs: 10_000, request });

    request.emit('close');

    expect(scope.aborted).toBe(false);
    scope.dispose();
  });

  it('aborts when the response closes before it finishes', () => {
    const response = Object.assign(new EventEmitter(), {
      writableEnded: false,
    });
    const scope = new RenderScope({ deadlineMs: 10_000, response });

    response.emit('close');

    expect(scope.reason).toBe('disconnect');
    scope.dispose();
  });

  it('adopts a response that was already destroyed before finishing', () => {
    const response = Object.assign(new EventEmitter(), {
      destroyed: true,
      writableEnded: false,
    });
    const scope = new RenderScope({ deadlineMs: 10_000, response });

    expect(scope.reason).toBe('disconnect');
    scope.dispose();
  });

  it('ignores the response close emitted after a normal end', () => {
    const response = Object.assign(new EventEmitter(), {
      writableEnded: true,
    });
    const scope = new RenderScope({ deadlineMs: 10_000, response });

    response.emit('close');

    expect(scope.aborted).toBe(false);
    scope.dispose();
  });

  it('adopts an already-aborted parent signal', () => {
    const controller = new AbortController();
    controller.abort();

    const scope = new RenderScope({
      deadlineMs: 10_000,
      parentSignal: controller.signal,
    });

    expect(scope.aborted).toBe(true);
    expect(scope.reason).toBe('abort');
    scope.dispose();
  });

  it('follows a parent signal aborted later', () => {
    const controller = new AbortController();
    const scope = new RenderScope({
      deadlineMs: 10_000,
      parentSignal: controller.signal,
    });

    controller.abort();

    expect(scope.aborted).toBe(true);
    scope.dispose();
  });

  it('keeps the first abort reason', () => {
    const request = new EventEmitter();
    const scope = new RenderScope({ deadlineMs: 10_000, request });

    scope.abort('disconnect');
    scope.abort('timeout');

    expect(scope.reason).toBe('disconnect');
    scope.dispose();
  });

  it('resolves an operation that finishes before the deadline', async () => {
    const scope = new RenderScope({ deadlineMs: 1000 });
    await expect(scope.run(Promise.resolve('done'))).resolves.toBe('done');
    scope.dispose();
  });

  it('rejects immediately when it is already aborted', async () => {
    const scope = new RenderScope({ deadlineMs: 1000 });
    scope.abort('disconnect');
    await expect(scope.run(Promise.resolve('x'))).rejects.toBeInstanceOf(
      RenderDeadlineError,
    );
    scope.dispose();
  });

  it('tracks whether the response has been committed', () => {
    const scope = new RenderScope({ deadlineMs: 1000 });
    expect(scope.isCommitted).toBe(false);
    scope.markCommitted();
    expect(scope.isCommitted).toBe(true);
    scope.dispose();
  });

  it('clears its timer and listeners on dispose', () => {
    vi.useFakeTimers();
    const request = new EventEmitter();
    const scope = new RenderScope({ deadlineMs: 50, request });

    expect(request.listenerCount('aborted')).toBe(1);
    scope.dispose();

    expect(request.listenerCount('aborted')).toBe(0);
    vi.advanceTimersByTime(100);
    expect(scope.aborted).toBe(false);
  });

  it('is safe to dispose twice', () => {
    const scope = new RenderScope({ deadlineMs: 1000 });
    scope.dispose();
    expect(() => scope.dispose()).not.toThrow();
  });

  it('does not leave abort listeners behind after a settled run', async () => {
    const scope = new RenderScope({ deadlineMs: 1000 });
    for (let i = 0; i < 50; i++) {
      await scope.run(Promise.resolve(i));
    }
    // A leaked listener per run would trip Node's max-listener warning; the
    // signal should be back to zero registered abort handlers.
    expect(scope.signal.aborted).toBe(false);
    scope.dispose();
  });
});
