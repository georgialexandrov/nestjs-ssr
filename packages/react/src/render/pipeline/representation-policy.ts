import type {
  CachePolicy,
  RepresentationPolicy,
  ResolvedRepresentationPolicy,
  SecurityHeadersPolicy,
} from '../../interfaces/representation-policy.interface';
import { RenderConfigurationError } from './errors';

/** Default serialized payload ceiling: 2 MiB. */
export const DEFAULT_MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;

/** Default payload nesting ceiling. */
export const DEFAULT_MAX_PAYLOAD_DEPTH = 64;

/** Default render deadline when neither policy nor `timeout` is configured. */
export const DEFAULT_DEADLINE_MS = 10_000;

/**
 * The secure baseline: HTML only, private and non-storable, nosniff on, and
 * a referrer policy that does not leak paths cross-origin.
 */
export function defaultResolvedPolicy(
  deadlineMs = DEFAULT_DEADLINE_MS,
): ResolvedRepresentationPolicy {
  return {
    html: true,
    json: false,
    default: 'html',
    limits: {
      mode: 'warn',
      maxBytes: DEFAULT_MAX_PAYLOAD_BYTES,
      maxDepth: DEFAULT_MAX_PAYLOAD_DEPTH,
    },
    deadlineMs,
    cache: { visibility: 'private', noStore: true, keys: [] },
    securityHeaders: {
      nosniff: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      contentSecurityPolicy: false,
    },
    emitResponseHeaders: false,
  };
}

function assertPositiveInteger(
  value: unknown,
  field: string,
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isInteger(value)
  ) {
    throw new RenderConfigurationError(
      `representation.${field} must be a positive integer, received ${String(value)}`,
    );
  }
}

function assertNonNegativeInteger(
  value: unknown,
  field: string,
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    !Number.isInteger(value)
  ) {
    throw new RenderConfigurationError(
      `representation.${field} must be a non-negative integer, received ${String(value)}`,
    );
  }
}

/**
 * Validate a policy object in isolation, before it is merged with anything.
 * `scope` names the source so the error points at the module or a route.
 */
export function validateRepresentationPolicy(
  policy: RepresentationPolicy | undefined,
  scope: 'module' | 'route',
): void {
  if (!policy) return;

  if (policy.html === false && policy.json === false) {
    throw new RenderConfigurationError(
      `${scope} representation policy disables every representation; a rendered route must offer at least one`,
    );
  }

  if (
    policy.default &&
    policy.default !== 'html' &&
    policy.default !== 'json'
  ) {
    throw new RenderConfigurationError(
      `${scope} representation.default must be 'html' or 'json', received ${String(policy.default)}`,
    );
  }

  if (policy.default === 'json' && policy.json === false) {
    throw new RenderConfigurationError(
      `${scope} representation.default is 'json' but JSON is disabled`,
    );
  }
  if (policy.default === 'html' && policy.html === false) {
    throw new RenderConfigurationError(
      `${scope} representation.default is 'html' but HTML is disabled`,
    );
  }

  if (
    policy.limits?.mode !== undefined &&
    policy.limits.mode !== 'warn' &&
    policy.limits.mode !== 'enforce'
  ) {
    throw new RenderConfigurationError(
      `${scope} representation.limits.mode must be 'warn' or 'enforce', received ${String(policy.limits.mode)}`,
    );
  }

  if (policy.limits?.maxBytes !== undefined) {
    assertPositiveInteger(policy.limits.maxBytes, 'limits.maxBytes');
  }
  if (policy.limits?.maxDepth !== undefined) {
    assertPositiveInteger(policy.limits.maxDepth, 'limits.maxDepth');
  }
  if (policy.deadlineMs !== undefined) {
    assertPositiveInteger(policy.deadlineMs, 'deadlineMs');
  }

  const cache = policy.cache;
  if (cache) {
    if (
      cache.visibility &&
      cache.visibility !== 'private' &&
      cache.visibility !== 'public'
    ) {
      throw new RenderConfigurationError(
        `${scope} representation.cache.visibility must be 'private' or 'public'`,
      );
    }
    for (const field of [
      'maxAge',
      'sMaxAge',
      'staleWhileRevalidate',
    ] as const) {
      if (cache[field] !== undefined) {
        assertNonNegativeInteger(cache[field], `cache.${field}`);
      }
    }
    if (cache.keys && !Array.isArray(cache.keys)) {
      throw new RenderConfigurationError(
        `${scope} representation.cache.keys must be an array of header names`,
      );
    }
    if (
      cache.visibility === 'public' &&
      cache.noStore !== false &&
      cache.maxAge === undefined &&
      cache.sMaxAge === undefined
    ) {
      throw new RenderConfigurationError(
        `${scope} representation.cache declares public visibility without a lifetime; set maxAge or sMaxAge`,
      );
    }
  }
}

function resolveCache(
  base: ResolvedRepresentationPolicy['cache'],
  override: CachePolicy | undefined,
): ResolvedRepresentationPolicy['cache'] {
  if (!override) return base;

  const visibility = override.visibility ?? base.visibility;
  // A public response is storable unless the caller insists otherwise;
  // a private one stays no-store unless it explicitly opts into storage.
  const noStore =
    override.noStore ??
    (override.visibility === 'public' ? false : base.noStore);

  return {
    visibility,
    noStore,
    keys: [...base.keys, ...(override.keys ?? [])],
    maxAge: override.maxAge ?? base.maxAge,
    sMaxAge: override.sMaxAge ?? base.sMaxAge,
    staleWhileRevalidate:
      override.staleWhileRevalidate ?? base.staleWhileRevalidate,
  };
}

function resolveSecurityHeaders(
  base: Required<SecurityHeadersPolicy>,
  override: SecurityHeadersPolicy | undefined,
): Required<SecurityHeadersPolicy> {
  if (!override) return base;
  return {
    nosniff: override.nosniff ?? base.nosniff,
    referrerPolicy: override.referrerPolicy ?? base.referrerPolicy,
    contentSecurityPolicy:
      override.contentSecurityPolicy ?? base.contentSecurityPolicy,
  };
}

/**
 * Resolve the module-level policy from configuration.
 *
 * `jsonApi` is the deprecated alias: it only decides JSON availability, and
 * only when the representation policy says nothing about it.
 */
export function resolveModulePolicy(options: {
  policy?: RepresentationPolicy;
  legacyJsonApi?: boolean;
  timeoutMs?: number;
}): ResolvedRepresentationPolicy {
  const { policy, legacyJsonApi, timeoutMs } = options;
  validateRepresentationPolicy(policy, 'module');

  const base = defaultResolvedPolicy(
    policy?.deadlineMs ??
      (typeof timeoutMs === 'number' && timeoutMs > 0
        ? timeoutMs
        : DEFAULT_DEADLINE_MS),
  );

  const json = policy?.json ?? legacyJsonApi ?? false;
  const html = policy?.html ?? true;

  return {
    html,
    json,
    default: policy?.default ?? (html ? 'html' : 'json'),
    limits: {
      mode: policy?.limits?.mode ?? base.limits.mode,
      maxBytes: policy?.limits?.maxBytes ?? base.limits.maxBytes,
      maxDepth: policy?.limits?.maxDepth ?? base.limits.maxDepth,
    },
    deadlineMs: base.deadlineMs,
    cache: resolveCache(base.cache, policy?.cache),
    securityHeaders: resolveSecurityHeaders(
      base.securityHeaders,
      policy?.securityHeaders,
    ),
    // The response-policy stage stays dormant until an application asks for
    // it. That keeps this release from adding headers to responses that never
    // carried them.
    emitResponseHeaders: !!(policy?.cache || policy?.securityHeaders),
  };
}

/**
 * Merge a route policy onto the resolved module policy.
 *
 * Routes may tighten limits but never raise them.
 */
export function resolveRoutePolicy(
  modulePolicy: ResolvedRepresentationPolicy,
  options: {
    policy?: RepresentationPolicy;
    legacyJsonApi?: boolean;
    routeLabel?: string;
  } = {},
): ResolvedRepresentationPolicy {
  const { policy, legacyJsonApi, routeLabel = 'route' } = options;
  if (!policy && legacyJsonApi === undefined) return modulePolicy;

  validateRepresentationPolicy(policy, 'route');

  const limits = { ...modulePolicy.limits };
  if (policy?.limits?.mode !== undefined) {
    limits.mode = policy.limits.mode;
  }
  if (policy?.limits?.maxBytes !== undefined) {
    if (policy.limits.maxBytes > modulePolicy.limits.maxBytes) {
      throw new RenderConfigurationError(
        `${routeLabel} raises representation.limits.maxBytes above the module limit (${modulePolicy.limits.maxBytes}); routes may only tighten limits`,
      );
    }
    limits.maxBytes = policy.limits.maxBytes;
  }
  if (policy?.limits?.maxDepth !== undefined) {
    if (policy.limits.maxDepth > modulePolicy.limits.maxDepth) {
      throw new RenderConfigurationError(
        `${routeLabel} raises representation.limits.maxDepth above the module limit (${modulePolicy.limits.maxDepth}); routes may only tighten limits`,
      );
    }
    limits.maxDepth = policy.limits.maxDepth;
  }

  const html = policy?.html ?? modulePolicy.html;
  const json = policy?.json ?? legacyJsonApi ?? modulePolicy.json;

  if (!html && !json) {
    throw new RenderConfigurationError(
      `${routeLabel} disables every representation; a rendered route must offer at least one`,
    );
  }

  let defaultRepresentation = policy?.default ?? modulePolicy.default;
  if (defaultRepresentation === 'json' && !json) defaultRepresentation = 'html';
  if (defaultRepresentation === 'html' && !html) defaultRepresentation = 'json';

  return {
    html,
    json,
    default: defaultRepresentation,
    limits,
    deadlineMs: policy?.deadlineMs ?? modulePolicy.deadlineMs,
    cache: resolveCache(modulePolicy.cache, policy?.cache),
    securityHeaders: resolveSecurityHeaders(
      modulePolicy.securityHeaders,
      policy?.securityHeaders,
    ),
    emitResponseHeaders:
      modulePolicy.emitResponseHeaders ||
      !!(policy?.cache || policy?.securityHeaders),
  };
}
