## Why

`@Render()` currently mixes response normalization, ad-hoc Accept-header checks, segment routing, serialization, and HTML rendering inside one interceptor. That makes it easy for a controller value or request field to cross the public response boundary unintentionally, and it cannot correctly model a single controller action that offers distinct HTML and API representations.

## What Changes

- Introduce an explicit, typed representation result so one controller action can offer HTML, JSON, and segment representations without branching on the raw request.
- Replace substring-based Accept detection with standards-aware negotiation, deterministic quality/specificity rules, `406` handling, and correct `Vary` metadata.
- Split the interceptor into negotiation, public-payload projection, rendering, and HTTP response-policy stages with adapter-neutral contracts.
- Add secure response defaults: allowlisted public request context, guarded serialization, private/no-store caching unless explicitly overridden, security-header hooks, render deadlines/cancellation, and validated segment payloads.
- Remove the implicit raw-string escape path from the secure pipeline; deliberate passthrough must use an explicit response result or a non-`@Render()` route.
- Keep existing plain-object controller returns and `jsonApi` configuration working through a compatibility adapter while emitting migration guidance.
- **BREAKING (next major):** remove the legacy raw-string shortcut and top-level request-field compatibility aliases after the deprecation window.

## Capabilities

### New Capabilities

- `representation-pipeline`: Typed controller results, representation projection, renderer selection, response writing, compatibility adaptation, and cancellation boundaries.
- `render-response-security`: Public-data exposure rules, safe serialization, response/cache/security policies, validation, limits, and failure behavior for rendered responses.

### Modified Capabilities

- `content-negotiation`: Negotiate all enabled representations using complete Accept semantics instead of a JSON substring check, with segment precedence and correct response metadata.
- `json-api-config`: Evolve the boolean `jsonApi` switch into representation policy while retaining it as a deprecated compatibility alias.

## Impact

- **Code:** `RenderInterceptor`, render response interfaces, decorators, module configuration, serializers, HTML/stream/segment renderers, Express/Fastify response adapters, client navigation, and tests.
- **Public API:** new typed response factories and representation-policy options; deprecations for `jsonApi`, raw strings on rendered routes, and unsafe request-context aliases.
- **Runtime behavior:** negotiated responses gain `Vary`, conservative cache defaults, bounded rendering, explicit serialization errors, and consistent `406` behavior.
- **Dependencies:** prefer small, audited media-type parsing and schema/serialization adapters only if native implementation is insufficient; no authentication or authorization framework is introduced.
