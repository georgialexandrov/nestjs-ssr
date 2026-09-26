## Context

`RenderInterceptor` currently performs six jobs: it interprets controller values, builds client-visible request context, detects segment requests, performs a substring check for JSON, resolves layouts, and writes adapter-specific responses. The controller's props become both HTML hydration state and, when `jsonApi` is enabled, the API body. A controller string bypasses the render path entirely. These shortcuts preserve a compact API but blur trust boundaries and make representation-specific DTOs impossible.

The design must retain NestJS controller ergonomics, work on Express and Fastify, support string and stream rendering, and permanently preserve current application contracts. Authentication and authorization remain Nest guard concerns, but this library owns what it serializes after a guard succeeds.

## Goals / Non-Goals

**Goals:**

- Let one controller action offer independently typed HTML and JSON values without reading or branching on `Accept`.
- Make negotiation deterministic for quality weights, wildcards, structured JSON suffixes, segment navigation, and unavailable representations.
- Establish one auditable public-data boundary shared by HTML hydration, JSON, and segment responses.
- Separate representation policy from rendering and from Express/Fastify response writing.
- Add conservative cache/header defaults and bounded, cancellable rendering.
- Add explicit representations alongside plain props and `jsonApi`, without requiring migration or deprecating existing forms.

**Non-Goals:**

- Authentication, authorization, rate limiting, CSRF protection, or application DTO validation.
- Automatic discovery of secrets in arbitrary application objects.
- Server-side HTML sanitization of application-authored `dangerouslySetInnerHTML`.
- Hard interruption of synchronous React CPU work; that requires worker/process isolation and is a possible later change.
- Negotiation for routes without `@Render()`.

## Decisions

### 1. Use a branded representation envelope

Add public factories with a shape equivalent to:

```ts
return representations({
  html: page({ props: pageViewModel, head, layoutProps }),
  json: api(publicApiDto),
});
```

`html` and `json` have independent generic types. The brand prevents an ordinary domain object that happens to contain `html` or `json` keys from being interpreted as framework control data. Factories may accept lazy producers so the unselected representation is not projected or serialized. A segment is not controller-authored; it is derived from the selected HTML page representation.

Existing plain props and `RenderResponse` values enter through a result adapter. `jsonApi: true` makes that adapter expose the page props as JSON exactly as before. A controller string is never confused with renderer output inside the new pipeline and permanently retains its passthrough behavior.

**Alternatives considered:** ask controllers to inspect `Accept`, which duplicates parsing and couples application logic to HTTP; infer control data structurally, which repeats the current ambiguity; use separate routes, which does not meet the same-URL requirement.

### 2. Build a staged, adapter-neutral pipeline

The interceptor becomes orchestration only:

```text
route policy + request headers
  -> RepresentationNegotiator
  -> controller result / LegacyResultAdapter
  -> PublicPayloadProjector
  -> Html | Json | Segment renderer
  -> ResponsePolicy
  -> HttpResponseWriter (Express or Fastify)
```

Each stage uses typed inputs and outputs and can be unit tested independently. The response writer is the only stage allowed to call adapter response methods. It owns status, `Content-Type`, `Vary`, cache headers, and pre-commit error behavior. Stream writers additionally own header-commit and abort lifecycle.

**Alternative considered:** continue adding branches to `RenderInterceptor`. This keeps fewer files but preserves intertwined failure modes and makes security review harder.

### 3. Negotiate explicit representations completely

For explicit `page()`, `api()`, and `representations()` results, the negotiator parses media ranges, `q` values, wildcards, parameters, and specificity. JSON supports `application/json` and compatible `application/*+json`; HTML supports `text/html`. A missing header or an equally ranked wildcard selects the route's configured default, initially HTML. `q=0` excludes a representation. If none of the route's representations are acceptable, the response is `406`.

Plain props, `RenderResponse`, and `jsonApi` permanently keep the exact substring-based selection and historical `406` body used by previous releases. Explicit factories are the opt-in boundary for standards semantics.

A valid GET segment request remains higher priority than normal Accept negotiation because it is the library's navigation protocol. It continues to accept the existing header-only client. All potentially selected headers are reflected in `Vary`.

**Alternative considered:** switch every controller shape. Although standards-correct, it changes successful responses for existing clients and is explicitly outside this change.

### 4. Project one public payload for every client-visible channel

`PublicPayloadProjector` constructs a detached, immutable, serialization-safe graph containing page data and public context. HTML hydration, API JSON, and segments consume this graph rather than the raw controller/domain result. Representation-specific projectors can deliberately return different DTOs, but each is subjected to the same serializer constraints and configured byte/depth limits. Unsupported existing values are diagnosed and passed through untouched in the default warning mode; enforce mode rejects them.

Base request context adds nested `headers` and `cookies` bags. Names are allowlisted and canonicalized; credential-bearing headers and cookies are denied even if misconfigured. Application context factories can provide values, but an optional projection/schema hook determines what reaches the public graph. Direct top-level header aliases, including their configured casing, remain supported because removing them would break components; reserved base context fields cannot be replaced.

Serialization in enforce mode rejects unsupported executable values and unsafe object shapes with a controlled server error before headers are committed. The default warning mode preserves existing behavior. Development-only diagnostics identify the failing path without logging its value.

**Alternative considered:** serialize the controller result directly. It is convenient, but prevents consistent exposure rules and representation-specific DTOs.

### 5. Centralize response security policy

When an application configures cache or security response policy, rendered and negotiated responses default to `Cache-Control: private, no-store`. The stage remains opt-in because adding headers is an API-visible change. A route may opt into public caching only with explicit cache metadata; the writer combines its cache keys with negotiation `Vary` fields. The response policy can add CSP (using the existing nonce factory), `X-Content-Type-Options: nosniff`, and `Referrer-Policy`. It never weakens or overwrites an application header already set by middleware.

Client segment HTML goes through one validated DOM-update adapter. The adapter verifies the segment schema, enforces payload limits, rejects unexpected navigation targets, and uses a configured Trusted Types policy when the browser enforces Trusted Types. Direct fragment `innerHTML` assignments outside this adapter are removed.

**Alternative considered:** require every host app to implement these details. Host configuration remains possible, but library defaults are needed because the library creates the serialized state, scripts, and DOM sink.

### 6. Propagate deadlines and cancellation

Create one render scope per request with an `AbortSignal`, deadline, and response-commit state. Client disconnect, configured timeout, or upstream cancellation aborts stream rendering and lazy projectors. Before headers are committed, timeout maps to a controlled `503`; after a stream begins, it aborts and closes without injecting an error payload into the document. Resource limits are configurable with conservative defaults.

**Alternative considered:** `Promise.race` only. That returns early but leaves rendering and data work running, so it does not provide an actual resource boundary.

## Risks / Trade-offs

- **[Risk] More public concepts make a simple controller look heavier** → Keep plain props supported, document `page()` as the simple secure default, and require `representations()` only when response DTOs differ.
- **[Risk] Conservative cache defaults change existing response headers** → Keep the response-policy stage permanently opt-in.
- **[Risk] `jsonApi` exposes page props that were not designed as API DTOs** → Preserve its contract and offer explicit representation DTOs as an additive safer choice.
- **[Risk] Stream failures after header commit cannot become a JSON error** → Track commit state, abort cleanly, and expose structured server-side diagnostics.
- **[Risk] Media-type parsing adds edge cases or a dependency** → Use conformance tests and adopt a small maintained parser only if a local parser cannot pass them.
- **[Trade-off] A Trusted Types policy vouches for server fragments rather than sanitizing them** → Document that application-authored raw HTML still needs an application sanitizer; keep all library DOM writes centralized for enforcement.

## Rollout Plan

1. Add the pipeline and explicit factories behind current behavior; migrate internal segment/full rendering to it.
2. Add representation policy while mapping `jsonApi` and existing controller values through the same pipeline without behavior changes.
3. Introduce secure context, serialization, cache, header, and deadline features behind additive or opt-in configuration.
4. Update documentation, type tests, and adapter tests with explicit-result examples while continuing to document existing forms.

Rollback is configuration-based: applications can stop using the new representation policy while retaining their existing controller contracts.

## Open Questions

- Should the public factory names be `page`/`api`/`representations`, or align with Nest terminology such as `view`/`json`/`respond`?
- Should malformed Accept syntax be ignored as an unavailable media range or fail with `400`? The proposed default is standards-tolerant parsing followed by `406` when nothing remains acceptable.
- Should public payload limits be module-only, or allow tighter per-route overrides?
- Should worker-thread isolation for synchronous rendering become a separate opt-in capability after this pipeline lands?
