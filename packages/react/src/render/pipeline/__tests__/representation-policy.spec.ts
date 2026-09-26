import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MAX_PAYLOAD_BYTES,
  defaultResolvedPolicy,
  resolveModulePolicy,
  resolveRoutePolicy,
  validateRepresentationPolicy,
} from '../representation-policy';
import { RenderConfigurationError } from '../errors';

describe('defaults', () => {
  it('offers HTML only and stores nothing', () => {
    const policy = defaultResolvedPolicy();
    expect(policy).toMatchObject({
      html: true,
      json: false,
      default: 'html',
      cache: { visibility: 'private', noStore: true, keys: [] },
      securityHeaders: {
        nosniff: true,
        referrerPolicy: 'strict-origin-when-cross-origin',
        contentSecurityPolicy: false,
      },
    });
    expect(policy.limits.maxBytes).toBe(DEFAULT_MAX_PAYLOAD_BYTES);
  });

  it('does not expose page props as JSON without configuration', () => {
    expect(resolveModulePolicy({}).json).toBe(false);
  });

  it('warns rather than enforces until an application opts in', () => {
    expect(defaultResolvedPolicy().limits.mode).toBe('warn');
  });

  it('emits no response headers unless one is configured', () => {
    expect(resolveModulePolicy({}).emitResponseHeaders).toBe(false);
    expect(
      resolveModulePolicy({ policy: { cache: { visibility: 'private' } } })
        .emitResponseHeaders,
    ).toBe(true);
    expect(
      resolveModulePolicy({ policy: { securityHeaders: { nosniff: true } } })
        .emitResponseHeaders,
    ).toBe(true);
  });

  it('lets a route turn the response-policy stage on for itself', () => {
    const base = resolveModulePolicy({});
    expect(
      resolveRoutePolicy(base, {
        policy: { securityHeaders: { referrerPolicy: 'no-referrer' } },
      }).emitResponseHeaders,
    ).toBe(true);
  });

  it('lets a route switch limits to enforce', () => {
    const base = resolveModulePolicy({});
    expect(
      resolveRoutePolicy(base, { policy: { limits: { mode: 'enforce' } } })
        .limits.mode,
    ).toBe('enforce');
  });

  it('rejects an unknown limits mode', () => {
    expect(() =>
      validateRepresentationPolicy(
        { limits: { mode: 'strict' as never } },
        'module',
      ),
    ).toThrow(/must be 'warn' or 'enforce'/);
  });
});

describe('validateRepresentationPolicy', () => {
  it('rejects a policy that disables every representation', () => {
    expect(() =>
      validateRepresentationPolicy({ html: false, json: false }, 'module'),
    ).toThrow(RenderConfigurationError);
  });

  it('rejects a default that names a disabled representation', () => {
    expect(() =>
      validateRepresentationPolicy({ json: false, default: 'json' }, 'module'),
    ).toThrow(/default is 'json' but JSON is disabled/);
  });

  it('rejects non-positive limits', () => {
    expect(() =>
      validateRepresentationPolicy({ limits: { maxBytes: 0 } }, 'module'),
    ).toThrow(/positive integer/);
    expect(() =>
      validateRepresentationPolicy({ limits: { maxDepth: -1 } }, 'module'),
    ).toThrow(/positive integer/);
  });

  it('rejects a public cache policy with no lifetime', () => {
    expect(() =>
      validateRepresentationPolicy(
        { cache: { visibility: 'public' } },
        'module',
      ),
    ).toThrow(/without a lifetime/);
  });

  it('accepts mandatory fields only at module scope', () => {
    expect(() =>
      validateRepresentationPolicy(
        { mandatory: ['limits', 'securityHeaders'] },
        'module',
      ),
    ).not.toThrow();
    expect(() =>
      validateRepresentationPolicy({ mandatory: ['limits'] }, 'route'),
    ).toThrow(/module-only/);
  });

  it('rejects unknown mandatory fields', () => {
    expect(() =>
      validateRepresentationPolicy(
        { mandatory: ['unknown' as never] },
        'module',
      ),
    ).toThrow(/unknown field/);
  });
});

describe('resolveModulePolicy', () => {
  it('treats the jsonApi flag as the JSON switch', () => {
    expect(resolveModulePolicy({ jsonApi: true }).json).toBe(true);
  });

  it('lets an explicit representation policy override the alias', () => {
    expect(
      resolveModulePolicy({
        policy: { json: false },
        jsonApi: true,
      }).json,
    ).toBe(false);
  });

  it('uses the module timeout as the render deadline', () => {
    expect(resolveModulePolicy({ timeoutMs: 2500 }).deadlineMs).toBe(2500);
  });

  it('prefers an explicit deadline over the module timeout', () => {
    expect(
      resolveModulePolicy({ policy: { deadlineMs: 500 }, timeoutMs: 2500 })
        .deadlineMs,
    ).toBe(500);
  });
});

describe('resolveRoutePolicy', () => {
  const modulePolicy = resolveModulePolicy({ policy: { json: true } });

  it('returns the module policy untouched when the route says nothing', () => {
    expect(resolveRoutePolicy(modulePolicy)).toBe(modulePolicy);
  });

  it('lets a route disable JSON', () => {
    expect(
      resolveRoutePolicy(modulePolicy, { policy: { json: false } }).json,
    ).toBe(false);
  });

  it('lets a route enable JSON the module disabled', () => {
    const htmlOnly = resolveModulePolicy({});
    expect(resolveRoutePolicy(htmlOnly, { policy: { json: true } }).json).toBe(
      true,
    );
  });

  it('accepts the route jsonApi option', () => {
    expect(
      resolveRoutePolicy(resolveModulePolicy({}), { jsonApi: true }).json,
    ).toBe(true);
  });

  it('lets a route tighten a limit', () => {
    const tightened = resolveRoutePolicy(modulePolicy, {
      policy: { limits: { maxBytes: 1024 } },
    });
    expect(tightened.limits.maxBytes).toBe(1024);
  });

  it('refuses to let a route raise a limit', () => {
    expect(() =>
      resolveRoutePolicy(modulePolicy, {
        policy: { limits: { maxBytes: DEFAULT_MAX_PAYLOAD_BYTES * 2 } },
        routeLabel: 'AppController.index',
      }),
    ).toThrow(/routes may only tighten limits/);
  });

  it('refuses to let a route weaken enforce mode', () => {
    const enforced = resolveModulePolicy({
      policy: { limits: { mode: 'enforce' } },
    });
    expect(() =>
      resolveRoutePolicy(enforced, {
        policy: { limits: { mode: 'warn' } },
        routeLabel: 'AppController.index',
      }),
    ).toThrow(/may only tighten limits/);
  });

  it('refuses to let a route lengthen the module deadline', () => {
    const short = resolveModulePolicy({ policy: { deadlineMs: 100 } });
    expect(() =>
      resolveRoutePolicy(short, {
        policy: { deadlineMs: 101 },
        routeLabel: 'AppController.index',
      }),
    ).toThrow(/may only tighten deadlines/);
  });

  it('prevents route overrides of module-mandatory fields', () => {
    const fixed = resolveModulePolicy({
      policy: {
        limits: { mode: 'enforce' },
        mandatory: ['limits', 'securityHeaders'],
      },
    });

    expect(() =>
      resolveRoutePolicy(fixed, {
        policy: { limits: { maxBytes: 1024 } },
        routeLabel: 'AppController.index',
      }),
    ).toThrow(/overrides mandatory representation\.limits/);
  });

  it('prevents the route jsonApi option from bypassing mandatory JSON', () => {
    const fixed = resolveModulePolicy({
      policy: { json: false, mandatory: ['json'] },
    });

    expect(() =>
      resolveRoutePolicy(fixed, {
        jsonApi: true,
        routeLabel: 'AppController.index',
      }),
    ).toThrow(/mandatory representation\.json/);
  });

  it('composes cache keys from module and route', () => {
    const withKeys = resolveModulePolicy({
      policy: { cache: { keys: ['Accept-Language'] } },
    });
    const routePolicy = resolveRoutePolicy(withKeys, {
      policy: {
        cache: { visibility: 'public', maxAge: 60, keys: ['X-Locale'] },
      },
    });

    expect(routePolicy.cache.keys).toEqual(['Accept-Language', 'X-Locale']);
    expect(routePolicy.cache.noStore).toBe(false);
  });

  it('rejects a route that disables everything', () => {
    expect(() =>
      resolveRoutePolicy(modulePolicy, {
        policy: { html: false, json: false },
      }),
    ).toThrow(RenderConfigurationError);
  });

  it('moves the default off a representation the route disabled', () => {
    const jsonDefault = resolveModulePolicy({
      policy: { json: true, default: 'json' },
    });
    expect(
      resolveRoutePolicy(jsonDefault, { policy: { json: false } }).default,
    ).toBe('html');
  });
});
