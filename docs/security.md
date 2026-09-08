# Security model

This library owns one boundary: what it serializes into a response after your guards have run. Everything on the other side of that boundary is yours. This page states which is which, so nothing falls between the two.

## What the library does

**One public payload boundary.** HTML hydration state, JSON bodies, and navigation segments all pass through the same projector before serialization. Valid projected values are detached from application-owned objects before the detached graph is frozen, so rendering never freezes controller or service state. Representation-specific DTOs are supported, but every one of them is held to the same rules.

**Bounded, non-executable serialization.** A client-visible payload is validated before response headers are committed. Functions, symbols, un-awaited promises, binary data, and prototype-polluting own keys are rejected; so is anything past the configured byte or depth limit. The default mode is `warn`, which reports a violation and serves the payload anyway, so adopting a release cannot turn a page that renders today into a 500; `representation.limits.mode: 'enforce'` refuses it instead. For JSON specifically, values JSON cannot represent (`Map`, `Set`, `RegExp`, `bigint`, cycles) are refused rather than silently flattened. Diagnostics name the property _path_ and never the value.

**Allowlisted request context.** Headers and cookies reach the client only through `context.headers` and `context.cookies`, canonicalized, and only when allowlisted. Credential-bearing headers are refused even when they appear in the allowlist, and the refusal is logged without the value. A header can never shadow `url`, `path`, or `method`.

**Response policy, on request.** Negotiation always adds the request headers that could change the representation to `Vary`. Beyond that, configuring `representation.cache` or `representation.securityHeaders` turns on a stage that applies `Cache-Control` (defaulting to `private, no-store`), `X-Content-Type-Options: nosniff`, a `Referrer-Policy`, and an optional nonce-based CSP. It never overwrites a header the host application already set. These policies remain opt-in so existing response contracts do not change.

**Standards-aware negotiation for explicit results.** Routes using `page()`, `api()`, or `representations()` parse media ranges in full — qualities, wildcards, exclusions, structured suffixes — and answer an unsatisfied request with `406` and the offered types, never controller data. Existing plain props, `RenderResponse`, and `jsonApi` permanently keep their historical Accept behavior.

**Bounded rendering.** Every rendered request gets one abort signal and deadline. A client disconnect or an expired deadline aborts abort-aware work. Before headers are committed that becomes a controlled `503`; after a stream has begun the stream is aborted and closed, without injecting an error payload into a partially delivered document.

**One DOM sink for navigation.** Segment responses are schema-, size-, and target-validated on the client before anything is written, and the write happens through a single Trusted Types policy (`nestjs-ssr-segment`). No other library path assigns segment HTML to an injection sink.

## What remains yours

**Authentication and authorization.** Use NestJS guards. The library renders whatever a controller returns after a guard has allowed the request; it has no notion of who is asking.

**CSRF protection.** Rendered routes are ordinary Nest routes. Use a CSRF middleware for state-changing requests.

**Rate limiting.** Rendering is CPU-bound. Deadlines bound one request; they do not bound how many arrive. Use `@nestjs/throttler` or an edge limit.

**Sanitizing your own HTML.** The Trusted Types policy vouches for markup this library received from your own server; it does not sanitize. Application-authored raw HTML — anything you hand to `dangerouslySetInnerHTML` — still needs an application-side sanitizer.

**Deciding what is public.** The projector enforces _how_ a payload is serialized, not _what_ belongs in it. If a controller returns a field, it ships. Use `projectContext` and representation-specific DTOs to decide what the browser sees.

**Proxy and body limits.** Request size, header size, connection limits, and TLS belong to your reverse proxy or platform.

**A Content-Security-Policy.** The library can emit a nonce-based CSP if you configure one and supply a nonce factory, and it will not overwrite yours. Choosing the policy is yours.

**Synchronous render cost.** A deadline cannot interrupt synchronous React work; it stops the pipeline around it. A component that blocks the event loop still blocks it. Keep render work asynchronous, or isolate it in a worker.

## Reporting

Security reports go to the process in [SECURITY.md](https://github.com/georgialexandrov/nestjs-ssr/blob/main/SECURITY.md).
