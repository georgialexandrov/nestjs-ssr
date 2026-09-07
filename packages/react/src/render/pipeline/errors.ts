/**
 * Error types raised by the render response pipeline.
 *
 * They are distinct classes so the interceptor can map each to the right HTTP
 * status without string-matching messages, and so a host application can
 * recognise them in an exception filter.
 */

/** Invalid module or route configuration. Raised at configuration time. */
export class RenderConfigurationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RenderConfigurationError';
  }
}

/** A client-visible payload could not be safely serialized. */
export class PayloadSerializationError extends Error {
  /**
   * Property path of the offending value, e.g. `props.user.onClick`.
   * Never contains the value itself — a rejected payload may hold secrets.
   */
  readonly path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = 'PayloadSerializationError';
    this.path = path;
  }
}

/** A client-visible payload exceeded the configured byte or depth limit. */
export class PayloadLimitError extends Error {
  readonly limit: number;
  readonly kind: 'bytes' | 'depth';

  constructor(message: string, kind: 'bytes' | 'depth', limit: number) {
    super(message);
    this.name = 'PayloadLimitError';
    this.kind = kind;
    this.limit = limit;
  }
}

/** Rendering exceeded its deadline, or the request was aborted. */
export class RenderDeadlineError extends Error {
  readonly reason: 'timeout' | 'disconnect' | 'abort';

  constructor(message: string, reason: 'timeout' | 'disconnect' | 'abort') {
    super(message);
    this.name = 'RenderDeadlineError';
    this.reason = reason;
  }
}
