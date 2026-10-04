# Proposal

## Why

A review on 2026-09-28 (server CPU profile of `/recipes`, code review, and
independent verification) found five correctness issues in the render and
navigation pipeline, and roughly 12-15% of remaining server CPU that can be
removed — on top of the work already landed in `nest-12-platform` — without
breaking changes. The owner approved the full plan the same day. This change
records it so the work is tracked and reviewable in the usual way, rather than
living only in review notes.

## What Changes

**Group 1 — correctness (in progress):**

- `toJSON` values 500 the HTML path while JSON works
  (`render/pipeline/public-snapshot.ts:629-665`): the snapshot keeps the
  unprojected copy instead of the validated projection. Fix: snapshot the
  validated projection with `JSON.stringify` semantics; `Date`s are unchanged.
- Client navigation race (`react/navigation/navigate.ts:56, 226`): no abort,
  no latest-wins, so overlapping clicks or back/forward navigation let the
  last-_resolving_ response win instead of the last-_requested_ one. Fix: an
  `AbortController` plus a navigation token; a superseded navigation is not
  treated as an error.
- Head not synced on client navigation (`react/navigation/navigate.ts:297-353`
  vs `render/template-parser.service.ts:325-351`): the client's `updateHead`
  applies title, description, keywords, OG tags and canonical, but never
  `head.meta` or `head.links`, and never removes a tag the new page dropped.
  The server's `buildHeadTags` already renders both. Fix: one shared
  head-field description consumed by the server builder and the client
  applier.
- Layout composition in three copies
  (`templates/entry-server.tsx:36`, `templates/entry-client.tsx:103` with
  swapped parameters, `react/navigation/hydrate-segment.tsx:128`) plus a unit
  test that tests its own local copy
  (`__tests__/unit/compose-layouts.spec.tsx:25`) — the mechanism behind five
  past hydration bugs. Fix: one function exported from
  `@nestjs-ssr/react/client`; per-site layout resolution is unchanged;
  markup stays byte-identical; the test asserts server vs. client markup
  equality instead of testing a private copy. This extends the layout
  de-duplication already planned in
  `2026-08-15-ssr-regression-safety-net` (section 2), which covers the
  server/client/test copies but not `hydrate-segment.tsx` — a fourth copy
  this review found, used during segment (client-navigation) rendering.
- Two render deadlines that agree only by coincidence: `RenderService`'s
  `SSR_TIMEOUT` / `withTimeout` (`render/render.service.ts:86, 98-103,
526-544`, `render/renderers/stream-renderer.ts:90-108`) vs.
  `RenderScope` / `representation.deadlineMs`
  (`render/pipeline/representation-policy.ts:257-264`,
  `render/pipeline/render-scope.ts`). Fix: one effective deadline per
  request; route-level tightening bounds the render, it doesn't race it.

**Group 2 — server speed (approved, next; from a CPU profile of `/recipes`):**

- Skip Express's SHA-1 `ETag` when the response's `Cache-Control` contains
  `no-store` (the library default) — 5.3% of CPU, 5-7 µs measured.
  Observable change (approved): no `ETag` header on no-store responses; no
  compliant client could revalidate them anyway. `304` behavior for
  cacheable responses is unchanged.
- The production static middleware (`render/vite-initializer.service.ts`)
  runs `fs.stat` on every request, including page routes — 2.9% (SSR) /
  4.4% (JSON) of CPU, ~4-6 µs estimated. Fix: index the immutable client
  build directory at startup and skip the syscall for paths not in the
  index. Observable change (approved): a file added to that directory while
  the server is running is not served until restart.
- `findClientEntry` is called 3x per render
  (`render/template-parser.service.ts:193, 215, 256`) — memoize it per
  manifest (~1 µs). `getRouteAssetTags`
  (`render/template-parser.service.ts:243-317`) is cached per view + layout
  chain in production (~1.5 µs); output stays byte-identical.
- Duplicate `RENDER_OPTIONS_KEY` reflector lookup
  (`render/render.interceptor.ts:149-152` and `:387-390`) — pass the
  resolved options through instead of reading twice (cleanliness, not
  measured as a distinct win).
- Investigate why a small page with `Date` props is ~6% slower on 0.4 than on
  0.3.31 (flagged, not yet explained, in `docs/performance.md`).

Target: ~-25% SSR CPU on `/recipes` vs. 0.3.31, measured in one interleaved
run (see "Measurement method" in `design.md`).

**Group 3 — elegance/API (non-breaking):**

- `@deprecated` JSDoc, kept working, removed only in the next major:
  `RenderConfig.jsonApi` (`interfaces/render-config.interface.ts:352`) in
  favor of `representation.json`; the static `.layout` / `.layoutProps`
  properties and `PageComponentWithLayout`
  (`interfaces/layout.interface.ts`), which are read only by
  `templates/entry-client.tsx:86-122` and ignored by the server, producing a
  hydration mismatch if used without the matching server-side layout;
  `JsonApiResponse<T>` (`interfaces/json-api-response.interface.ts:17`), a
  no-op type alias. **Not** `RenderConfig.timeout` — it drives a real
  timeout and stays.
- Rename `render/pipeline/legacy-result-adapter.ts` to
  `controller-result-adapter.ts` — it handles every controller return shape,
  not a legacy one; internal file, no export path changes.
- `useCookies` lacks the `Array.isArray` guard `useCookie` already has
  (`react/hooks/use-page-context.tsx:361-370` vs. `:386-403`); make
  `useRequest` an alias of `usePageContext` (`:225-233`, `:285-291`);
  `loadViewModules` (`react/navigation/lazy-views.ts:120`) returns a copy of
  the module registry per navigation — return the registry itself.
- Later, measured first: emit large plain hydration state as
  `<script type="application/json">` plus `JSON.parse` while setting the
  same `window.__*` globals, which is possible now that plain state is JSON.
  Only worth it in the tens-of-KB range; not scheduled until measured.

**Considered and rejected:** skipping `<Link>` handler closures during SSR
(~3 µs, fragile); further payload-snapshot squeezing (it's the
security-critical validator, already tuned); cheaper string-to-bytes
encoding (tried in the 2026-09-27 review follow-up — the cost moves to the
socket write, so it doesn't win end to end).

## Capabilities

### New Capabilities

- `client-navigation-integrity`: correctness guarantees for client-side
  `navigate()` — overlapping navigations resolve latest-requested-wins
  without treating a superseded navigation as an error, and the document
  head (title, meta, links, Open Graph tags) is fully synced to the current
  page on every client-side navigation, including removal of tags the new
  page doesn't declare.
- `static-asset-serving`: what the production static-file middleware serves
  from the immutable client build directory, and the explicit tradeoff of
  indexing it once at startup rather than checking the filesystem per
  request.

### Modified Capabilities

- `render-response-security`: "Render deadlines have safe failure behavior"
  is restated so exactly one effective deadline governs a request instead of
  two independently configured timers that happen to agree; adds a
  requirement that `ETag` is omitted on responses whose `Cache-Control`
  includes `no-store`.

## Impact

- **Library code (Group 1):** `render/pipeline/public-snapshot.ts`,
  `react/navigation/navigate.ts`, `render/template-parser.service.ts`,
  `templates/entry-server.tsx`, `templates/entry-client.tsx`,
  `react/navigation/hydrate-segment.tsx`,
  `__tests__/unit/compose-layouts.spec.tsx`, `render/render.service.ts`,
  `render/renderers/stream-renderer.ts`,
  `render/pipeline/representation-policy.ts`,
  `render/pipeline/render-scope.ts`.
- **Library code (Group 2):** `render/vite-initializer.service.ts`,
  `render/pipeline/response-policy.ts`, `render/template-parser.service.ts`,
  `render/render.interceptor.ts`.
- **Library code (Group 3):** `interfaces/render-config.interface.ts`,
  `interfaces/layout.interface.ts`,
  `interfaces/json-api-response.interface.ts`,
  `render/pipeline/legacy-result-adapter.ts` (renamed),
  `react/hooks/use-page-context.tsx`, `react/navigation/lazy-views.ts`.
- **Tests:** every Group 1 fix ships with a regression test that fails
  against the pre-fix code (per the repo's convention, e.g.
  `2026-08-15-ssr-regression-safety-net`); every Group 2 item is measured in
  the single interleaved run described in `docs/performance.md` before and
  after; Group 3 items keep all existing tests passing and add coverage for
  the new alias/return-registry behavior.
- **Docs:** `docs/performance.md` gains a row per landed Group 2 item,
  measured the same way as the existing table; `design.md`'s "Measured
  reality" section in `nest-12-platform` is left as historical record and
  not edited.
- **Users:** no action required. All changes are backwards compatible.
  Two observable, approved behavior changes ship in Group 2: no `ETag`
  header on `no-store` responses, and static files added to the client
  build directory after server start are not served until restart (both
  already true in effect for any deployment that restarts on every deploy).
- **Coordination:** the layout de-duplication in Group 1 should land after
  or alongside `2026-08-15-ssr-regression-safety-net` section 2, since both
  touch `templates/entry-server.tsx` and `templates/entry-client.tsx`; this
  change's task extends that one to also cover `hydrate-segment.tsx`.
