import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type {
  PageData,
  ResolvedLayout,
} from '../../interfaces/component.interface';
import type { HeadData } from '../../interfaces/render-response.interface';
import type { RenderContext } from '../../interfaces/render-context.interface';
import type { SSRRequest } from '../../interfaces/http-adapters.interface';
import type {
  SerializationLimits,
  SerializationTarget,
} from './safe-serialize';
import { snapshotPublicPayload, type PublicSnapshot } from './public-snapshot';
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

function finishProjection<T>(original: T, snapshot: PublicSnapshot<T>): T {
  // A valid snapshot comes back already deeply frozen. Warn-mode
  // compatibility permits unsupported legacy values through; those are the
  // application's own objects and are returned untouched.
  return snapshot.valid ? snapshot.value : original;
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

    const snapshot = snapshotPublicPayload(
      projected,
      {
        limits,
        target: 'devalue',
        label: 'context',
        mode: limits.mode,
        onViolation: (error) => this.warn(error),
      },
      { freeze: true },
    );

    return finishProjection(projected, snapshot);
  }

  /** Project and validate page props destined for HTML hydration. */
  projectPageData(data: PageData, limits: SerializationLimits): PageData {
    const snapshot = snapshotPublicPayload(
      data,
      {
        limits,
        target: 'devalue',
        label: 'props',
        mode: limits.mode,
        onViolation: (error) => this.warn(error),
      },
      { freeze: true },
    );
    return finishProjection(data, snapshot);
  }

  /** Project and validate a JSON API body. */
  projectJson<T>(value: T, limits: SerializationLimits): T {
    const snapshot = snapshotPublicPayload(
      value,
      {
        limits,
        target: 'json',
        label: 'json',
        mode: limits.mode,
        onViolation: (error) => this.warn(error),
      },
      { freeze: true },
    );
    return finishProjection(value, snapshot);
  }

  /** Project and validate the props embedded in a navigation segment. */
  projectSegmentData(data: PageData, limits: SerializationLimits): PageData {
    // A segment carries the same hydration state as the HTML page it derives
    // from, so it is held to the same rules and the same limits.
    const snapshot = snapshotPublicPayload(
      data,
      {
        limits,
        target: 'json',
        label: 'segment props',
        mode: limits.mode,
        onViolation: (error) => this.warn(error),
      },
      { freeze: true },
    );
    return finishProjection(data, snapshot);
  }

  /**
   * Validate the remaining client-visible fields after the default head has
   * been merged and the final layout chain has been resolved. Components
   * stay server-side; only their props can cross the response boundary.
   */
  projectRenderMetadata(
    layouts: ResolvedLayout[] | undefined,
    head: HeadData | undefined,
    limits: SerializationLimits,
    target: SerializationTarget,
  ): { layouts: ResolvedLayout[] | undefined; head: HeadData | undefined } {
    const metadata = {
      head,
      layoutProps: layouts?.map((layout) => layout.props),
    };
    const snapshot = snapshotPublicPayload(
      metadata,
      {
        limits,
        target,
        label: 'metadata',
        mode: limits.mode,
        onViolation: (error) => this.warn(error),
      },
      { freeze: true },
    );
    const projected = finishProjection(metadata, snapshot);

    return {
      head: projected.head,
      layouts: layouts?.map((layout, index) => ({
        ...layout,
        props: projected.layoutProps?.[index],
      })),
    };
  }

  /** Development-only diagnostic describing why a payload was refused. */
  reportRejection(error: unknown, isDevelopment: boolean): void {
    if (!isDevelopment || !(error instanceof Error)) return;
    // The message carries the property path, never the property value.
    this.logger.error(error.message);
  }
}
