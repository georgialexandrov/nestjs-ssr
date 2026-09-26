## Why

`@Render()` currently mixes response normalization, ad-hoc Accept-header checks, segment routing, serialization, and HTML rendering inside one interceptor. That makes it easy for a controller value or request field to cross the public response boundary unintentionally, and it cannot correctly model a single controller action that offers distinct HTML and API representations.

## What Changes

- Introduce an explicit, typed representation result so one controller action can offer HTML, JSON, and segment representations without branching on the raw request.
- Add standards-aware negotiation, deterministic quality/specificity rules, `406` handling, and correct `Vary` metadata for the new explicit result API while permanently preserving Accept behavior for existing controller shapes.
- Split the interceptor into negotiation, public-payload projection, rendering, and HTTP response-policy stages with adapter-neutral contracts.
- Add opt-in secure response policy: allowlisted public request context, guarded serialization with a non-breaking warning mode, private/no-store caching when response policy is configured, security-header hooks, render deadlines/cancellation, and validated segment payloads.
- Preserve raw-string passthrough on `@Render()` routes as part of the existing API contract while documenting that it bypasses the secure pipeline.
- Keep existing plain-object controller returns, `jsonApi` configuration, raw strings, and top-level request-field aliases working without deprecation diagnostics or planned removal.

## Capabilities

### New Capabilities

- `representation-pipeline`: Typed controller results, representation projection, renderer selection, response writing, established-result adaptation, and cancellation boundaries.
- `render-response-security`: Public-data exposure rules, safe serialization, response/cache/security policies, validation, limits, and failure behavior for rendered responses.

### Modified Capabilities

- `content-negotiation`: Negotiate explicit representations using complete Accept semantics, permanently retain historical substring behavior for existing controller shapes, and provide segment precedence and correct response metadata.
- `json-api-config`: Add representation policy alongside the supported boolean `jsonApi` switch.

## Impact

- **Code:** `RenderInterceptor`, render response interfaces, decorators, module configuration, serializers, HTML/stream/segment renderers, Express/Fastify response adapters, client navigation, and tests.
- **Public API:** additive typed response factories and representation-policy options; existing APIs retain their status and behavior.
- **Runtime behavior:** negotiated responses retain `Vary`, gain opt-in cache/security policy, bounded rendering, opt-in enforcement, and explicit-result `406` metadata without changing existing response contracts.
- **Dependencies:** prefer small, audited media-type parsing and schema/serialization adapters only if native implementation is insufficient; no authentication or authorization framework is introduced.
