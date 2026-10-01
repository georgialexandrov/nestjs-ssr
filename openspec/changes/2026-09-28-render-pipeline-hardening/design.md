# Design

## Context

`nest-12-platform` already replaced clone-validate-freeze with a single-pass
snapshot, cached the production server bundle, added a JSON fast path for
plain hydration state, and precompiled the HTML template. The single
interleaved run in `docs/performance.md` puts 0.4 (without this change) at
-8% SSR CPU on `/recipes` vs. 0.3.31, -17% on a 50-item list, and +6%
(unexplained) on a page whose props contain `Date`s.

A follow-up review on 2026-09-28 — a CPU profile of `/recipes`, a code
review, and independent verification of both — found two more classes of
issue this change addresses:

1. Five correctness bugs, none caught by the existing test suite, in the
   snapshot's `toJSON` handling, client navigation, head sync, layout
   composition, and render deadlines. See proposal.md's "Group 1" for the
   locations.
2. Further, smaller server-CPU wins (Group 2) than the ones `nest-12-platform`
   already took, plus a small set of non-breaking API cleanups (Group 3).

See `proposal.md` for the full item list; this document covers rationale,
alternatives, and risk per item.

## Goals / Non-Goals

**Goals:**

- Fix all five Group 1 correctness bugs with a regression test each that
  fails against the pre-fix code, matching the convention set by
  `2026-08-15-ssr-regression-safety-net`.
- Land the approved Group 2 items, each measured individually in the single
  interleaved run described below, targeting ~-25% cumulative SSR CPU on
  `/recipes` vs. 0.3.31.
- Ship the Group 3 deprecations and renames with zero behavior change for
  existing callers.
- Keep every change backwards compatible: no public API removal, no response
  format change except the two explicitly approved in Group 2.

**Non-Goals:**

- Re-opening the withdrawn 1.8x SSR-throughput goal from `nest-12-platform`
  (see its design.md, "Measured reality").
- The three "considered and rejected" items in proposal.md.
- Removing any `@deprecated` API before the next major.
- Explaining the `Date`-props regression (item 10) — this change only tracks
  the investigation; a fix, if one exists, is separate follow-up work.

## Decisions

### D1. Snapshot the validated projection, not the unprojected copy

`public-snapshot.ts:629-665` currently walks a node with an own `toJSON`,
calls it, and validates the _result_, but the snapshot returned to callers
still holds the original, unprojected object (`node`). The HTML path and the
JSON path both read from that same snapshot; the JSON path happens to work
because `JSON.stringify` calls `toJSON()` itself downstream, but the HTML
path serializes the snapshot directly and 500s when the unprojected value
contains something the projector was supposed to remove.

**Fix:** the snapshot stores the value returned by `toJSON()` — validated the
same way — in place of the original node, for every target, not just JSON.
Values that are already plain (no own `toJSON`) are unaffected. `Date` output
is unchanged, since `Date.prototype.toJSON` already returns the ISO string
form both paths expect.

**Alternative:** special-case the HTML path to call `toJSON()` again at
serialization time. Rejected: reintroduces the double-walk this change's
predecessor removed, and revalidates a value the snapshot already validated
once.

### D2. Navigation race: `AbortController` plus a token

`navigate.ts:56` fetches the segment with no `AbortController`; `navigate.ts:226`
applies whichever response resolves last, not whichever was requested last.
Two overlapping navigations — a fast double click, or a click during
back/forward — can apply a stale response over a newer one.

**Fix:** each call to `navigate()` creates an `AbortController` and
increments a module-level token. Before applying a response, the token at
apply time is compared to the token captured at request time; a mismatch
means a newer navigation started and the response is discarded rather than
applied. The in-flight fetch for a superseded navigation is aborted. An
`AbortError` from a superseded fetch is swallowed, not surfaced to the
caller or `NavigationProvider` — only a genuine failure of the _current_
navigation is an error.

**Alternative:** a request queue that serializes navigations. Rejected: it
would delay the second click instead of preferring it, which is the wrong
default for a user who changed their mind.

### D3. One head-field description, applied by both sides

The server's `buildHeadTags` (`render/template-parser.service.ts:325-351`)
renders title, description, keywords, OG tags, canonical link, **and**
`head.meta` / `head.links`. The client's `updateHead`
(`react/navigation/navigate.ts:297-353`) handles everything except
`head.meta` and `head.links`, and only ever adds or updates a tag — it never
removes one the previous page set and the new page doesn't declare. A
navigation away from a page with custom meta/link tags leaves them in the DOM
indefinitely.

**Fix:** extract the list of head fields (predefined tags plus the
`meta`/`links` arrays) into one shared description consumed by both
`buildHeadTags` and `updateHead`, so a field added to one side is applied by
the other automatically. `updateHead` additionally tracks which
dynamically-added elements it owns (a `data-nestjs-ssr-head` marker) so it
can remove ones the new page doesn't repeat, without touching tags the host
page or another script manages.

**Alternative:** diff the full `<head>` against a server-rendered
reference on every navigation. Rejected: more DOM work per navigation for a
case the marker approach handles directly.

### D4. One layout-composition function, four call sites reduced to one

Three independent implementations exist:
`templates/entry-server.tsx:36` (`composeWithLayouts`),
`templates/entry-client.tsx:103` (`composeWithLayout`, singular, with
`context` and `layouts` swapped relative to the server version), and
`react/navigation/hydrate-segment.tsx:128` (`composeWithLayouts` again, with
yet another signature that takes a `modules` map). A fourth copy lives in
`__tests__/unit/compose-layouts.spec.tsx:25`, which the file's own comment
admits: _"Extracted layout composition logic - must match entry-server.tsx
and entry-client.tsx."_ It tests itself, not the shipped code, so it cannot
fail on the divergence it exists to catch — the documented cause of five past
hydration bugs (`b9bd070`, `71d1bc4`, `d283a48`, `3e5a3bf`, `b956ea2`, per
`2026-08-15-ssr-regression-safety-net`).

**Fix:** one function, exported from `@nestjs-ssr/react/client`, used by all
three call sites. Per-site layout _resolution_ (how each caller assembles its
`layouts` array — from decorator metadata on the server, from the static
`.layout` chain or a segment response on the client) stays where it is;
only the composition step — wrapping the page in each layout in the correct
order with the right `data-layout`/`data-outlet` markers — is shared.
Rendered markup must stay byte-identical to today's output. The spec test is
rewritten to import the real export and assert server-rendered markup equals
client-hydrated markup, rather than defining its own copy.

**Coordination:** `2026-08-15-ssr-regression-safety-net` section 2 already
plans this exact extraction for the server and client entry templates and
their test. It does not mention `hydrate-segment.tsx`, which this review
found as a fourth copy used during segment (same-origin client) navigation.
Whichever change lands first should create
`react/compose/compose-layouts.tsx`; the other should update
`hydrate-segment.tsx` to use it rather than re-deriving the extraction
independently. See tasks.md for how this change accounts for that overlap.

**Alternative:** keep the copies but add a byte-identical output test across
all three without consolidating. Rejected: a test can confirm today's three
copies agree; it can't stop a fourth divergence next time someone adds a
render path, which is exactly how this bug family has recurred.

### D5. One effective render deadline

Two independent timers currently bound the same request: `RenderService`'s
`SSR_TIMEOUT` / `withTimeout` (`render/render.service.ts:86, 98-103,
526-544`) and the string-mode equivalent in `renderers/stream-renderer.ts`
(module path: `render/renderers/stream-renderer.ts:90-108`) on one side; and
`RenderScope`, constructed from `representation.deadlineMs`
(`render/pipeline/representation-policy.ts:257-264`,
`render/pipeline/render-scope.ts`), on the other. They agree today only
because both default to `10_000`ms and nothing currently sets them
independently — a route or module that overrides one without the other would
silently get whichever fires first, with no guarantee it's the intended one.

**Fix:** `RenderScope`'s `deadlineMs` becomes the single source of truth.
`RenderService.timeoutMs` (from `SSR_TIMEOUT`) is folded into how the
effective deadline is computed — the more restrictive of the two configured
values wins, so a route-level `representation.deadlineMs` can tighten but not
loosen the module-level `SSR_TIMEOUT`, matching the existing "route can
tighten" pattern used elsewhere in representation policy. `withTimeout` and
the stream-renderer's own timer stop owning a deadline; they consume
`RenderScope`'s signal instead, so there is exactly one clock and one abort
path per request.

**Alternative:** deprecate `SSR_TIMEOUT` outright and require
`representation.deadlineMs`. Rejected: `SSR_TIMEOUT` is documented,
constructor-level, public API; folding it into the computation keeps it
working without asking every existing app to migrate.

### D6. Skip Express's ETag for `no-store` responses

Express computes a SHA-1 `ETag` for every response body by default. Profiled
at 5.3% of server CPU, 5-7 µs per request, entirely wasted for a response
whose `Cache-Control` already says `no-store` — no compliant client caches or
revalidates a `no-store` response, so the header can never be used.

**Fix:** where `render/pipeline/response-policy.ts` sets `Cache-Control` to
include `no-store` (the library's default per the existing "Conservative
response cache policy" requirement), also disable per-response ETag
generation for that response. Responses that declare a public, cacheable
policy are unaffected — they keep `ETag` and `304` behavior exactly as
today.

**Alternative:** disable ETags globally via `app.set('etag', false)`.
Rejected: that also removes them from a route that explicitly opts into
public caching, which still benefits from revalidation.

### D7. Index the static build directory at startup

`render/vite-initializer.service.ts` wires the platform adapter's static
middleware (Express's `express.static`, or `@fastify/static`) over the
production client build directory. That middleware calls `fs.stat` per
request to decide whether a path exists and whether it's a directory —
including for every page route, which never matches a static file but still
pays the syscall. Profiled at 2.9% (SSR) / 4.4% (JSON) of CPU, ~4-6 µs
estimated per request.

**Fix:** at startup, recursively list the immutable client build directory
once into an in-memory index (a `Set` of served paths). A request path not
in the index skips the static middleware entirely instead of asking the
filesystem. The build directory's contents don't change while the process
runs — Vite writes it once per build, before the server starts serving.

**Observable change (approved):** a file added to (or removed from) the
directory after the server has started is not served (or keeps being
served) until restart. This matches how Vite production builds are already
deployed — the directory's `[hash]` filenames mean a mid-life file add is not
a supported workflow today either — but it is now an explicit, documented
property rather than an accident of `fs.stat` freshness.

**Alternative:** cache `fs.stat` results with a short TTL. Rejected: still
pays the syscall on every cache miss and every page route, and trades a
larger, harder-to-reason-about staleness window for a small win.

### D8. Memoize `findClientEntry`; cache `getRouteAssetTags`

`findClientEntry` (`render/template-parser.service.ts:360`) reads and parses
the Vite manifest; it's called three times per render
(`template-parser.service.ts:193, 215, 256`) with the same manifest object.
**Fix:** memoize it per manifest reference (~1 µs). `getRouteAssetTags`
(`:243-317`) computes the same tag list for the same `(view, layout chain)`
pair on every request in production, where the manifest and layout chain are
both static; **fix:** cache it per `(handler, layout chain)` key in
production only, invalidated in development on module updates the same way
the existing per-route caches from `nest-12-platform` are. Output stays
byte-identical — this is answering the same question faster, not changing
what's answered.

### D9. Pass `RENDER_OPTIONS_KEY` reflector result through once

`render.interceptor.ts:149-152` and `:387-390` both call
`this.reflector.get(RENDER_OPTIONS_KEY, context.getHandler())` for the same
`ExecutionContext` within one request. **Fix:** resolve it once and pass the
result to whichever internal method needs it later. This is a cleanliness
fix (duplicate reflection work on every request, reading the same decorator
metadata twice), not separately benchmarked — it's bundled with D8 in the
CPU profile.

### D10. `Date`-props regression — tracked, not fixed here

`docs/performance.md` reports a page whose props contain `Date`s at +6% CPU
on 0.4 vs. 0.3.31, confirmed above the 0.6%-apart noise floor measured on
identical code. The cause is not yet identified — the JSON fast path doesn't
apply to `Date`-bearing payloads, so it isn't the explanation. This change
tracks the investigation as a task (see tasks.md) but does not schedule a
fix until the cause is known; the fix, once found, is separate follow-up
work sized after diagnosis.

### D11. `@deprecated` JSDoc for three redundant surfaces

- `RenderConfig.jsonApi` (`interfaces/render-config.interface.ts:352`) is
  superseded by `representation.json` from the representation-pipeline work;
  both are read today, `jsonApi` stays but is marked for removal in the next
  major.
- The static `.layout` / `.layoutProps` component properties and
  `PageComponentWithLayout` (`interfaces/layout.interface.ts`) are read only
  by the client entry template's fallback chain-walk
  (`templates/entry-client.tsx:86-122`) and never by the server, which
  builds its layout chain from decorator metadata instead. A component using
  only the static-property form renders correctly on the server (root layout
  only, since the server doesn't see the static chain) and then hydrates
  with the client's fuller chain — a hydration mismatch. It's deprecated,
  not removed, because existing apps may already work around this by
  duplicating layout info; removal is a breaking change for the next major
  to make explicit.
- `JsonApiResponse<T>` (`interfaces/json-api-response.interface.ts:17`) is a
  no-op type alias with no runtime behavior; deprecated in favor of using the
  plain response type directly.

`RenderConfig.timeout` is explicitly excluded — it drives the real deadline
described in D5 and has no replacement.

### D12. Rename `legacy-result-adapter.ts`

`render/pipeline/legacy-result-adapter.ts` handles every controller return
shape the library supports today, not a legacy one — the name is left over
from when it handled only pre-representation-pipeline results. Renamed to
`controller-result-adapter.ts`. Internal file, not exported from any package
entry point; no consumer-visible change.

### D13. Small API consistency fixes

- `useCookies` (`react/hooks/use-page-context.tsx:361-370`) returns
  `context.cookies` cast to a record without checking it isn't an array,
  unlike `useCookie` (`:386-403`), which has the `!Array.isArray(cookies)`
  guard. An array value (which shouldn't occur, but isn't currently
  prevented at the type level) would pass through `useCookies` as if it were
  a record. Fix: add the same guard.
- `useRequest` (`:225-233`) and `usePageContext` (`:285-291`) currently carry
  two separate implementations of what is the same read. Fix: `useRequest`
  becomes a direct alias of `usePageContext`, removing the duplicate.
- `loadViewModules` (`react/navigation/lazy-views.ts:120`) returns
  `{ ...loaded }`, a fresh shallow copy of the module registry, on every
  navigation. Fix: return the registry object itself — callers only read
  from it, so the copy has never protected anything, and it's a per-navigation
  allocation for no benefit.

### D14. JSON hydration state as `<script type="application/json">` — deferred

Once plain hydration state is emitted via `JSON.stringify` (already shipped
in `nest-12-platform`), it becomes valid to place it in a
`<script type="application/json">` element and read it with
`JSON.parse` instead of inlining it into a `<script>` that assigns
`window.__*` globals directly — same globals, different transport, avoiding a
class of `</script>`-in-string-content escaping concerns and letting the
browser's JSON parser (typically faster than the HTML tokenizer re-entering
script content) do the work. **Not scheduled**: proposal.md's own framing is
"measure first," and it only pays off once payloads reach the tens-of-KB
range, which is above the sizes this library's own examples and the
`/recipes` profile exercise today. Recorded here so the option isn't
rediscovered from scratch when a large-payload app hits it.

## Measurement method

Every Group 2 item's gain is shown in the single interleaved run described in
`docs/performance.md` under "Server rendering cost": one harness, builds
interleaved round-robin, minimum of 10 rounds, `process.cpuUsage()` diffed
over a fixed load window. Each item is measured against the version of the
library immediately before it (isolating its own contribution) and the
resulting cumulative number is also reported against 0.3.31 (the number a
user upgrading from 0.3.31 actually sees). Wall-clock req/s is not used as a
gate, per the `nest-12-platform` finding that it swings 1.4k-8k req/s on a
shared machine.

## Risks / Trade-offs

- **No `ETag` on `no-store` responses removes a header some middleware or
  proxy might inspect for reasons unrelated to caching** → Audited: nothing
  in this repo's own middleware chain reads response `ETag`; this is scoped
  to the library's own no-store responses, not a global `app.set`.
- **Static-directory indexing means a file added mid-process isn't served
  until restart** → Matches how hashed Vite build output is already
  deployed; documented as an explicit, approved behavior change rather than
  left as an `fs.stat`-freshness accident.
- **Folding `SSR_TIMEOUT` into `RenderScope`'s deadline computation touches a
  path every render goes through** → Existing timeout tests
  (`render.service.spec.ts`, stream-renderer tests, representation-policy
  tests) must keep passing unchanged in the common case (only one of the two
  values configured); new tests cover both configured with different
  values, asserting the tighter one wins.
- **The layout-composition extraction overlaps with
  `2026-08-15-ssr-regression-safety-net`** → See D4's "Coordination." Landing
  order is decided at implementation time, not fixed here, since it depends
  on which change reaches that section first.
- **The `toJSON` snapshot fix changes what serializes for any payload with a
  custom `toJSON` that was previously silently 500ing** → This is a bug fix,
  not a behavior change to anything that worked before: a payload that used
  to 500 on the HTML path now renders the same value the JSON path already
  produced. No passing case regresses.
- **Rollback** → Each Group is small enough to land and revert independently
  per item; none depend on a Group 2 or Group 3 item to be correct, so a
  problem in one item does not block the rest.

## Open Questions

- **D10, the `Date`-props regression:** what specifically in the 0.4 render
  path costs 6% more than 0.3.31 for `Date`-bearing props, given the JSON
  fast path doesn't apply to that page? Left open in `docs/performance.md`;
  resolving it may or may not produce a Group 2-sized item of its own.
