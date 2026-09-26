import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { PageData } from '../../interfaces/component.interface';
import type { RenderContext } from '../../interfaces/render-context.interface';
import type { SSRRequest } from '../../interfaces/http-adapters.interface';
import type { SerializationLimits } from './safe-serialize';
import { validatePublicPayload } from './safe-serialize';
import type { PayloadLimitError, PayloadSerializationError } from './errors';

/**
 * Hook that decides what part of the enriched render context is public.
 *
 * The `context` factory is where applications attach request-scoped data —
 * a user, a tenant, feature flags. That data is often the domain object, not
 * a DTO. This hook is the one place to narrow it before it is embedded in
 * the HTML, returned as JSON, or sent in a segment.
 */
export type ContextProjector = (params: {
  context: RenderContext;
  req: SSRRequest;
  signal?: AbortSignal;
}) => RenderContext | Promise<RenderContext>;

/** DI token for the context projection hook. */
export const CONTEXT_PROJECTOR = 'CONTEXT_PROJECTOR';

/**
 * Recursively freeze a projected graph.
 *
 * Once projected, the payload is handed to renderers, the serializer, and
 * (in stream mode) code that runs after the response has begun. Freezing
 * makes it impossible for a later stage to add a field that never passed
 * through validation.
 */
export function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== 'object' || value === null) return value;
  const object = value as unknown as object;
  if (seen.has(object)) return value;
  seen.add(object);

  // Properties are read directly rather than through descriptors: the
  // validator has already walked this same graph, so any accessor has run,
  // and a descriptor lookup per key costs about as much as the freeze itself.
  if (object instanceof Map) {
    for (const [key, child] of object) {
      if (typeof key === 'object' && key !== null) deepFreeze(key, seen);
      if (typeof child === 'object' && child !== null) deepFreeze(child, seen);
    }
    const immutable = () => {
      throw new TypeError('Cannot mutate a projected public Map');
    };
    Object.defineProperties(object, {
      set: { value: immutable },
      delete: { value: immutable },
      clear: { value: immutable },
    });
  } else if (object instanceof Set) {
    for (const child of object) {
      if (typeof child === 'object' && child !== null) deepFreeze(child, seen);
    }
    const immutable = () => {
      throw new TypeError('Cannot mutate a projected public Set');
    };
    Object.defineProperties(object, {
      add: { value: immutable },
      delete: { value: immutable },
      clear: { value: immutable },
    });
  } else if (Array.isArray(object)) {
    for (let index = 0; index < object.length; index++) {
      const child: unknown = object[index];
      if (typeof child === 'object' && child !== null) deepFreeze(child, seen);
    }
  } else {
    for (const key of Object.keys(object)) {
      const child: unknown = (object as Record<string, unknown>)[key];
      if (typeof child === 'object' && child !== null) deepFreeze(child, seen);
    }
  }

  return Object.freeze(value);
}

/**
 * Detach a validated public graph from controller and service-owned objects.
 * Supported serializer types and cycles retain their semantics, but the
 * frozen result never shares mutable object identity with application state.
 */
export function clonePublicGraph<T>(
  value: T,
  seen = new WeakMap<object, unknown>(),
): T {
  if (typeof value !== 'object' || value === null) return value;

  const source = value as unknown as object;
  const existing = seen.get(source);
  if (existing !== undefined) return existing as T;

  // These types are rejected by validation. Retaining their identity until
  // that decision avoids manufacturing objects with the right prototype but
  // missing the internal slots used by Promise and binary-data APIs.
  if (
    source instanceof Promise ||
    source instanceof WeakMap ||
    source instanceof WeakSet ||
    source instanceof ArrayBuffer ||
    ArrayBuffer.isView(source)
  ) {
    return value;
  }

  if (source instanceof Date) return new Date(source.getTime()) as T;
  if (source instanceof RegExp) {
    return new RegExp(source.source, source.flags) as T;
  }

  if (source instanceof Map) {
    const clone = new Map<unknown, unknown>();
    seen.set(source, clone);
    for (const [key, child] of source) {
      clone.set(clonePublicGraph(key, seen), clonePublicGraph(child, seen));
    }
    return clone as T;
  }

  if (source instanceof Set) {
    const clone = new Set<unknown>();
    seen.set(source, clone);
    for (const child of source) clone.add(clonePublicGraph(child, seen));
    return clone as T;
  }

  const prototype = Reflect.getPrototypeOf(source);
  const clone: unknown[] | Record<string, unknown> = Array.isArray(source)
    ? []
    : (Object.create(prototype) as Record<string, unknown>);
  seen.set(source, clone);

  for (const key of Object.keys(source)) {
    Object.defineProperty(clone, key, {
      value: clonePublicGraph((source as Record<string, unknown>)[key], seen),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }

  return clone as T;
}

function finishProjection<T>(original: T, detached: T, valid: boolean): T {
  // Warn-mode compatibility permits unsupported legacy values through. Do
  // not mutate them while they follow the previous serializer behavior.
  return valid ? deepFreeze(detached) : original;
}

/**
 * The single boundary every client-visible payload crosses.
 *
 * HTML hydration state, JSON API bodies, and navigation segments all go
 * through this projector, so exposure rules and size limits are enforced in
 * one auditable place rather than once per channel.
 */
@Injectable()
export class PublicPayloadProjector {
  private readonly logger = new Logger(PublicPayloadProjector.name);

  /** Paths already reported in warn mode, so a hot route logs once. */
  private readonly reported = new Set<string>();

  /**
   * Report a violation the payload was allowed through with.
   *
   * Warn mode exists so that adopting this release cannot turn a page that
   * renders today into a 500. The diagnostic is the point of it: it names the
   * property path — never the value — so an application can see what will
   * fail once limits are enforced.
   */
  private warn(error: PayloadLimitError | PayloadSerializationError): void {
    if (this.reported.has(error.message)) return;
    this.reported.add(error.message);
    this.logger.warn(
      `${error.message}. This is allowed through because representation.limits.mode ` +
        "is 'warn'; it will be refused once the mode is 'enforce'.",
    );
  }

  constructor(
    @Optional()
    @Inject(CONTEXT_PROJECTOR)
    private readonly contextProjector?: ContextProjector,
  ) {}

  /**
   * Project and validate the render context.
   * Runs the application's projection hook first, so anything the context
   * factory attached is narrowed before it is measured or frozen.
   */
  async projectContext(
    context: RenderContext,
    req: SSRRequest,
    limits: SerializationLimits,
    signal?: AbortSignal,
  ): Promise<RenderContext> {
    const projectorParams: Parameters<ContextProjector>[0] = { context, req };
    // As with ContextFactory, preserve the existing enumerable callback shape.
    Object.defineProperty(projectorParams, 'signal', {
      value: signal,
      enumerable: false,
    });
    const projected = this.contextProjector
      ? await this.contextProjector(projectorParams)
      : context;

    const detached = clonePublicGraph(projected);
    const validation = validatePublicPayload(detached, {
      limits,
      target: 'devalue',
      label: 'context',
      mode: limits.mode,
      onViolation: (error) => this.warn(error),
    });

    return finishProjection(projected, detached, validation.valid);
  }

  /** Project and validate page props destined for HTML hydration. */
  projectPageData(data: PageData, limits: SerializationLimits): PageData {
    const detached = clonePublicGraph(data);
    const validation = validatePublicPayload(detached, {
      limits,
      target: 'devalue',
      label: 'props',
      mode: limits.mode,
      onViolation: (error) => this.warn(error),
    });
    return finishProjection(data, detached, validation.valid);
  }

  /** Project and validate a JSON API body. */
  projectJson<T>(value: T, limits: SerializationLimits): T {
    const detached = clonePublicGraph(value);
    const validation = validatePublicPayload(detached, {
      limits,
      target: 'json',
      label: 'json',
      mode: limits.mode,
      onViolation: (error) => this.warn(error),
    });
    return finishProjection(value, detached, validation.valid);
  }

  /** Project and validate the props embedded in a navigation segment. */
  projectSegmentData(data: PageData, limits: SerializationLimits): PageData {
    // A segment carries the same hydration state as the HTML page it derives
    // from, so it is held to the same rules and the same limits.
    const detached = clonePublicGraph(data);
    const validation = validatePublicPayload(detached, {
      limits,
      target: 'json',
      label: 'segment props',
      mode: limits.mode,
      onViolation: (error) => this.warn(error),
    });
    return finishProjection(data, detached, validation.valid);
  }

  /** Development-only diagnostic describing why a payload was refused. */
  reportRejection(error: unknown, isDevelopment: boolean): void {
    if (!isDevelopment || !(error instanceof Error)) return;
    // The message carries the property path, never the property value.
    this.logger.error(error.message);
  }
}
