import { RenderDeadlineError } from './errors';

/** Why a render scope aborted. */
export type AbortReason = 'timeout' | 'disconnect' | 'abort';

interface EventSource {
  aborted?: boolean;
  on?: (event: string, listener: (...args: any[]) => void) => unknown;
  off?: (event: string, listener: (...args: any[]) => void) => unknown;
  removeListener?: (
    event: string,
    listener: (...args: any[]) => void,
  ) => unknown;
}

interface ResponseEventSource extends EventSource {
  writableEnded?: boolean;
  finished?: boolean;
  destroyed?: boolean;
}

export interface RenderScopeOptions {
  /** Deadline for the whole render, in milliseconds. */
  deadlineMs: number;
  /** Request object, listened to for client disconnect. */
  request?: EventSource;
  /** Raw response object, whose premature close signals a disconnect. */
  response?: ResponseEventSource;
  /** Upstream signal (e.g. a host-level shutdown signal). */
  parentSignal?: AbortSignal;
}

/**
 * One cancellation boundary per rendered request.
 *
 * A `Promise.race` against a timer returns early but leaves the render, the
 * lazy projectors, and any data work still running. This scope carries a real
 * `AbortSignal` instead, so abort-aware work stops and its resources are
 * released, and it tracks whether response headers have been committed —
 * which decides whether a failure can still become a 503 or must abort a
 * stream that is already on the wire.
 */
export class RenderScope {
  private readonly controller = new AbortController();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private cleanups: Array<() => void> = [];
  private abortReason: AbortReason | null = null;
  private committed = false;
  private disposed = false;

  readonly deadlineMs: number;

  constructor(options: RenderScopeOptions) {
    this.deadlineMs = options.deadlineMs;

    this.timer = setTimeout(() => {
      this.abort('timeout');
    }, options.deadlineMs);
    // A pending render deadline must not hold the process open.
    this.timer.unref?.();

    const request = options.request;
    if (request?.aborted) {
      this.abort('disconnect');
    } else if (request?.on) {
      const onAborted = () => this.abort('disconnect');
      request.on('aborted', onAborted);
      this.cleanups.push(() => {
        const off = request.off ?? request.removeListener;
        off?.call(request, 'aborted', onAborted);
      });
    }

    const response = options.response;
    if (response?.destroyed && !response.writableEnded && !response.finished) {
      this.abort('disconnect');
    } else if (response?.on) {
      const onClose = () => {
        if (response.writableEnded || response.finished) return;
        this.abort('disconnect');
      };
      response.on('close', onClose);
      this.cleanups.push(() => {
        const off = response.off ?? response.removeListener;
        off?.call(response, 'close', onClose);
      });
    }

    const parent = options.parentSignal;
    if (parent) {
      if (parent.aborted) {
        this.abort('abort');
      } else {
        const onAbort = () => this.abort('abort');
        parent.addEventListener('abort', onAbort, { once: true });
        this.cleanups.push(() => parent.removeEventListener('abort', onAbort));
      }
    }
  }

  /** Signal handed to renderers and abort-aware projectors. */
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get aborted(): boolean {
    return this.controller.signal.aborted;
  }

  get reason(): AbortReason | null {
    return this.abortReason;
  }

  /** Whether response headers have gone out and the outcome is no longer changeable. */
  get isCommitted(): boolean {
    return this.committed;
  }

  /** Record that the response has begun; failures after this cannot become a status code. */
  markCommitted(): void {
    this.committed = true;
  }

  /** Abort the scope. The first reason wins. */
  abort(reason: AbortReason): void {
    if (this.controller.signal.aborted) return;
    this.abortReason = reason;
    this.controller.abort(this.toError(reason));
  }

  /** The error describing this scope's abort, for a caller that must throw. */
  toError(
    reason: AbortReason = this.abortReason ?? 'abort',
  ): RenderDeadlineError {
    const message =
      reason === 'timeout'
        ? `Render exceeded its ${this.deadlineMs}ms deadline`
        : reason === 'disconnect'
          ? 'Client disconnected before the render completed'
          : 'Render was aborted';
    return new RenderDeadlineError(message, reason);
  }

  /**
   * Race an operation against this scope.
   * The operation keeps running only if it ignores the signal; abort-aware
   * work stops as soon as the scope aborts.
   */
  async run<T>(operation: Promise<T>): Promise<T> {
    if (this.aborted) throw this.toError();

    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(this.toError());
      this.controller.signal.addEventListener('abort', onAbort, { once: true });
      operation.then(resolve, reject).finally(() => {
        this.controller.signal.removeEventListener('abort', onAbort);
      });
    });
  }

  /** Release the timer and every listener this scope registered. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    for (const cleanup of this.cleanups) {
      try {
        cleanup();
      } catch {
        // A listener that is already gone is not an error worth surfacing.
      }
    }
    this.cleanups = [];
  }
}
