## 1. Characterize and Scaffold

- [ ] 1.1 Add regression tests for current HTML, JSON API, segment, raw-string, context, cache, and Express/Fastify behavior before refactoring
- [ ] 1.2 Define branded `page`, `api`, and `representations` result types with compile-time tests for independent HTML and JSON DTOs
- [ ] 1.3 Define adapter-neutral negotiated-request, public-payload, rendered-representation, response-policy, and render-scope contracts
- [ ] 1.4 Add configuration validation for representation defaults, limits, deadlines, cache policy, and non-weakenable module policy

## 2. Content Negotiation

- [ ] 2.1 Implement and unit-test Accept parsing for qualities, specificity, parameters, wildcards, exclusions, client order, and structured JSON suffixes
- [ ] 2.2 Implement representation selection and stable `406` problem responses from route and module policies
- [ ] 2.3 Model valid segment navigation as the highest-priority derived HTML representation and preserve invalid-header fallback behavior
- [ ] 2.4 Add cache-correct `Vary` composition tests for `Accept`, `X-Current-Layouts`, existing values, and both HTTP adapters

## 3. Public Data Boundary

- [ ] 3.1 Implement nested, canonicalized request `headers` and `cookies` bags with credential denylisting and collision tests
- [ ] 3.2 Implement public representation/context projector hooks and ensure HTML hydration, JSON, and segments consume only projected values
- [ ] 3.3 Implement serialization validation for executable values, unsafe shapes, depth, and byte limits with value-safe diagnostics
- [ ] 3.4 Add cross-channel leakage tests using secrets omitted from page, API, and context projectors

## 4. Rendering and HTTP Response Pipeline

- [ ] 4.1 Extract negotiation, legacy adaptation, projection, rendering, policy, and writing orchestration from `RenderInterceptor`
- [ ] 4.2 Implement Express and Fastify response writers with equivalent status, media type, header, pre-commit error, and stream behavior
- [ ] 4.3 Route full HTML, JSON, and derived segment rendering through the new pipeline without changing valid layout behavior
- [ ] 4.4 Add conservative private/no-store defaults and explicit public-cache policy with composed cache keys
- [ ] 4.5 Add composable CSP nonce, nosniff, and referrer-policy handling that preserves host-provided headers

## 5. Deadlines and Client Sink

- [ ] 5.1 Add request-scoped `AbortSignal`, deadline, disconnect propagation, and cleanup to projectors and renderers
- [ ] 5.2 Implement pre-commit `503` and post-commit stream-abort behavior with leak and timer cleanup tests
- [ ] 5.3 Define and validate the versioned segment response schema, payload limit, and layout-target constraints
- [ ] 5.4 Centralize segment DOM updates, add Trusted Types policy integration, and remove other direct fragment HTML sink assignments
- [ ] 5.5 Add browser tests for invalid targets, oversized/malformed segments, Trusted Types enforcement, and safe full-navigation fallback

## 6. Compatibility and Migration

- [ ] 6.1 Implement `LegacyResultAdapter` for plain props, `RenderResponse`, and `jsonApi` with development-only migration diagnostics
- [ ] 6.2 Add deprecation diagnostics and tests for raw controller strings and top-level allowed-header/cookie aliases
- [ ] 6.3 Update generated templates, minimal example, API report, and documentation with same-payload and distinct-DTO controller examples
- [ ] 6.4 Publish a migration guide and codemod strategy for `jsonApi`, explicit response factories, context bags, and next-major removals

## 7. Release Gates

- [ ] 7.1 Run unit, integration, browser, type, lint, dependency-boundary, package-size, and security-policy suites on Node LTS versions
- [ ] 7.2 Fuzz Accept parsing, serialization limits, segment schema validation, and hostile context configuration
- [ ] 7.3 Benchmark string and stream modes for latency, allocations, abort cleanup, and payload overhead against the recorded baseline
- [ ] 7.4 Complete a focused security review and document remaining host responsibilities for auth, CSRF, rate limiting, raw HTML, and proxy limits
