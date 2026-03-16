## Context

nestjs-ssr's `RenderInterceptor` sits between the controller return value and the HTTP response. It currently has two response paths:

1. **Full page render** — calls `RenderService.render()`, returns HTML
2. **Segment render** — detected via `X-Current-Layouts` header, returns JSON for client-side navigation

The interceptor already knows how to skip rendering and return JSON (segment path). JSON API mode adds a third path: return the raw controller data as structured JSON when the client requests it.

Current flow (simplified):

```
Controller returns data
  → RenderInterceptor.intercept()
    → resolveLayoutChain()
    → detectRequestType()
      → segment? return JSON segment
      → full page? RenderService.render() → HTML
```

## Goals / Non-Goals

**Goals:**

- Same route serves HTML (browsers) and JSON (agents/APIs) based on request headers
- Zero breaking changes — existing apps work identically without config changes
- Works with both Express and Fastify
- Per-route and module-level control
- Clean JSON shape with props + metadata

**Non-Goals:**

- GraphQL or partial field selection — this returns the full props object
- Response caching or ETags — orthogonal concern
- Authentication/authorization for JSON mode — users handle this with NestJS guards
- Streaming JSON responses — string serialization only
- Content negotiation for non-`@Render()` routes — only intercepted routes

## Decisions

### 1. Intercept in RenderInterceptor, not a separate interceptor

**Decision:** Add JSON detection to the existing `RenderInterceptor` rather than creating a new `JsonApiInterceptor`.

**Why:** The interceptor already has all the context — component metadata, resolved layouts, head data, render response. A separate interceptor would need to duplicate this or run after it, which creates ordering issues. The segment response path already proves the pattern works.

**Alternative considered:** Separate interceptor registered conditionally. Rejected because it would need access to the same metadata and would complicate the interceptor ordering.

### 2. Check headers after layout resolution, before rendering

**Decision:** Insert JSON API check after `resolveLayoutChain()` and `normalizeResponse()` but before `detectRequestType()` / `RenderService.render()`.

**Why:** At this point we have the normalized `RenderResponse` with props. We don't need layout resolution or rendering — just return the data.

```
Controller returns data
  → RenderInterceptor.intercept()
    → resolveLayoutChain()
    → normalizeResponse()
    → NEW: isJsonRequest()?
      → yes + jsonApi enabled? → return JSON response
      → yes + jsonApi disabled? → return 406
      → no? → continue to segment/render as before
```

### 3. Header detection: `Accept: application/json` only

**Decision:** Use the standard `Accept` header. No custom headers.

**Why:** Every HTTP client can set `Accept`. A custom header doubles the detection surface and test matrix for a theoretical problem. If someone hits a real case where they can't set Accept, that's a feature request with evidence behind it.

### 4. JSON response shape

**Decision:** Return the controller's data object directly — no wrapper, no metadata.

```json
{ "recipes": [...], "total": 42 }
```

**Why:** The JSON consumer wants the application data, not rendering concerns. Head/meta (title, description) exists for the page — it's meaningless to an API client. Wrapping in `{ data: ... }` adds a layer that every consumer has to unwrap for no benefit. The controller already controls the shape.

**Alternative considered:** `{ data: <props>, meta: { title, route, statusCode } }`. Rejected — the meta is a rendering concern, and wrapping adds unnecessary structure. If a consumer needs the HTTP status, it's already in the response headers.

### 5. Config: module-level default + per-route override

**Decision:**

- `RenderModule.forRoot({ jsonApi: true })` — enables globally
- `@Render(Component, { jsonApi: false })` — disables for specific route
- Per-route overrides module-level. Absence means "use module default."

**Why:** Most apps will want it on or off globally. Per-route is needed for routes that return sensitive data or shouldn't be machine-queryable.

Config resolution: `route.jsonApi ?? module.jsonApi ?? false`

### 6. 406 Not Acceptable when disabled

**Decision:** When a JSON request hits a route where `jsonApi` resolves to `false`, return 406 with body `{ error: "Not Acceptable", message: "JSON response not available for this route" }`.

**Why:** 406 is the correct HTTP status for "I understand what you want but won't serve it in that format." Silent fallback to HTML would confuse API clients. Returning the HTML anyway when JSON was explicitly requested is worse.

## Risks / Trade-offs

**[Risk] Segment detection conflicts with JSON API detection**
→ Segment requests use `X-Current-Layouts` header and are always GET. JSON API uses `Accept` header. Check JSON API first; if the request has `X-Current-Layouts`, treat it as a segment request regardless of `Accept` header (client-side nav always wants segments, not raw JSON).

**[Risk] Large props objects serialized to JSON**
→ Not our problem to solve. The same data is already serialized into `__INITIAL_STATE__` in the HTML. If anything, JSON mode is lighter because it skips rendering.

**[Risk] Users expect filtering/pagination on JSON mode**
→ Non-goal. Document clearly that JSON mode returns the same data the component receives. Query parameters work the same way — the controller processes them.

**[Trade-off] Per-route granularity requires metadata on every route**
→ Acceptable. The `RenderOptions` interface already exists and is the natural place. Default-to-module-config means most routes need nothing.
