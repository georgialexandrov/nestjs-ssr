# Performance

Numbers from the repository's own harnesses, on `examples/minimal` (Apple
silicon, Node 26, NestJS 12). They are guides, not guarantees: measure your
own application the same way.

## Server rendering cost

Server CPU per request, measured inside the NestJS process (`process.cpuUsage()`
diff over a fixed load window: 20 concurrent fetch loops, 1 s warm-up, 3 s
measured), minimum of 10 rounds, one harness with builds interleaved
round-robin:

| CPU µs/request (min of 10)                  | 0.3.31 | 0.4 before Group 2 | 0.4 (Group 2) |
| ------------------------------------------- | ------ | ------------------ | ------------- |
| SSR `/recipes`                              | 162.4  | 128.4 (−21%)       | 108.5 (−33%)  |
| SSR, 50-item list page                      | 950.9  | 649.3 (−32%)       | 622.5 (−35%)  |
| JSON `/recipes`                             | 71.8   | 67.1 (−7%)         | 59.6 (−17%)   |
| SSR, small page whose props contain `Date`s | 59.7   | 66.4 (+11%)        | 58.6 (−2%)    |

**Since this table:** 0.4.0-rc.1 also validates head and layout props per
request. A local `perf:http` A/B on 2026-10-04 (two runs per arm, not the
interleaved harness above) put SSR `/recipes` at 101–102 µs CPU/request without
it and 106–108 µs with it, about 5% more; the CI gate ratio stays within budget
(0.44 against a 0.40 minimum). Re-measure with the harness before 0.4.0.

Percentages are against 0.3.31. Measured 2026-09-29 on `examples/minimal`, one
interleaved harness, 4 arms (0.3.31, 0.4-before-Group-2, 0.4-with-Group-2-as-shipped,
and a since-dropped head-serialization-fast-path prototype) round-robin ×10,
min of 10, machine otherwise idle (no other CPU-heavy process running during
the measured window). The "0.4 (Group 2)" column reflects the shipped code
(no head fast path). 0.3.31 is the npm-published package with a 2-line `__dirname` shim
so its ESM build can start — the ESM `ReferenceError` the migration guide
lists as fixed in 0.4. Group 2 (render-pipeline-hardening) landed ETag
suppression on `no-store` responses, a startup index for the static-file
middleware, per-manifest/per-route render caches, and a single
`RENDER_OPTIONS_KEY` resolution per request; cumulative SSR `/recipes` is
−33% vs 0.3.31, past the ~−25% target. The step-by-step measurements the
2026-09-28 single run replaced — each optimization compared against the one
before it, across separate runs, which overstated the cumulative gain — are
kept for history in "Measured reality" in
`openspec/changes/nest-12-platform/design.md`.

### Date-props regression (task 2.5) — root-caused, regression gone

The prior run's +6% on the small `Date`-props page (0.4 before Group 2: 66.4
µs vs 0.3.31's 59.7 — the 62.7/66.4 figures in the earlier run used a
different 0.3.31 baseline) was not Dates taking a slow path: the library's
own payload pipeline is faster per-payload than 0.3.31 in every case,
Dates included. The cause was one **new, unconditional** cost
`buildInlineScripts` pays on every SSR response that 0.3.31 never paid at
all: computing and serializing `window.__HEAD__` (added for the
head-sync/navigation fix, design.md D3) through the same general
`snapshotPublicPayload` walk used for page props — a full walk (Map/Set
registries, path tracking, byte accounting) for what's almost always a
tiny, already-application-controlled object. In isolated micro-benchmarking
this fixed cost measured ~1.3 µs on `buildInlineScripts` alone; on a page
whose whole pipeline costs 5-6 µs that's large enough to flip a win into a
loss on paper.

A fast path was prototyped (`serializeSmallValueForHydration`, serializing a
plain, small `HeadData`-shaped object directly instead of routing it through
the general snapshot walk) to remove that fixed cost. Measured at the
request level, isolated to this one change (NEW = full Group 2 with the
prototype, NEW-nohead = Group 2 with the prototype reversed, same
interleaved run as the table above): on the `Date`-props page, NEW min 58.7
µs vs NEW-nohead min 58.6 µs — indistinguishable at this run's noise floor.
The ~1.3 µs the micro-benchmark showed in isolation doesn't survive contact
with a full request's own round-to-round noise, so the prototype was
dropped rather than shipped; the table above reflects the shipped code
without it.

The regression is gone anyway: the Date page **no longer regresses** against
0.3.31 at all (0.4-before-Group-2 was +11% over 0.3.31 in this run;
0.4-with-Group-2-as-shipped is −2%). That's the rest of Group 2's
request-path savings (ETag suppression, static-index skip, cache reuse)
landing on the same small page — enough on its own to erase the +11%
without the head fast path. No further follow-up item is opened — the
regression this task set out to explain is gone.

The payload snapshot matters more as pages carry more data, and the JSON fast
path shows the same shape: on the pipeline micro-benchmark, whose page props
are a 50-item list, a server-rendered response went from 150 µs to 106 µs
(−30%, a different, labelled harness — see `pnpm bench` below). In the
2026-09-28 run that isolated the JSON fast path on its own (0.4 with vs.
without it, kept for history in "Measured reality" in
`openspec/changes/nest-12-platform/design.md`), the fast path itself was −8%
on SSR `/recipes`, −17% on the 50-item list, and no change on the Date page
(the fast path doesn't apply to Date-bearing payloads, so the same devalue
path runs as before).

Every change but the JSON fast path produces byte-identical responses: the
old implementations are kept as test oracles and tens of thousands of random
payloads must match them exactly. The JSON fast path is the one exception —
for plain hydration state it emits `JSON.stringify` directly instead of
devalue's format, so response bytes change (quoted keys: +2–3% raw body,
~+0.5% gzipped). The hydrated value does not change: both forms are
evaluated and required to be deeply equal. Payloads devalue must still
handle — Dates, `undefined`, `-0`/`NaN`/`Infinity`, shared references,
null-prototype objects — fall back to the old, byte-identical path.

What remains, per request, from a CPU profile of `/recipes`: React's
`renderToString` (about a sixth), encoding the finished page into bytes for
the socket (a page built from many small strings costs several times more to
encode than one flat string), the payload snapshot, the hydration-state
serialization, and HTTP/Express/Nest overhead that JSON responses pay too.
Server rendering keeps about half the capacity of returning the same data as
JSON (0.54 on `/recipes` with Group 2 landed, min-of-10 interleaved; 0.46 on
the CI gate's own wall-clock throughput harness, see below); CI fails the
build if that drops below 0.40.

Run it yourself:

```bash
cd packages/react
pnpm perf:http            # builds the example, loads it, reports CPU/request
pnpm bench                # pipeline micro-benchmark
```

### Static asset lookups (Express)

In production, on the Express adapter, the library indexes the client build
directory (`dist/client`) once at startup instead of asking the filesystem
(`fs.stat`) whether each request path is a build asset. A request path not in
that startup index skips the static-file handler entirely and goes straight
to routing — this is what removes the `fs.stat` most page routes and JSON
routes were paying on every request even though they never serve a static
file.

**Caveat:** because the index is built once, a file added to (or removed
from) `dist/client` after the server has started is not served (or keeps
being served) until the process restarts. This matches how Vite production
builds are already deployed in practice — the build directory's `[hash]`
filenames mean adding a file mid-life was never a supported workflow — but it
is now an explicit, documented property of the static-file path rather than
an accident of `fs.stat` freshness. Restart the process after any change to
`dist/client` outside of a normal build-then-deploy.

If the build directory can't be listed at startup (missing, permissions),
the library falls back to asking the filesystem on every request, exactly as
before this change — the index is a fast path, not a correctness
requirement.

Fastify does not need this: `@fastify/static` registers its file lookup as a
wildcard route, not middleware ahead of every request, and Fastify's router
already prefers an app-registered route over that wildcard for the same
path. A page route there never reaches the static plugin's own `fs.stat` in
the first place.

## Client JavaScript per page

Initial JavaScript a page downloads, including React:

| Views in the app | All views bundled (0.3) | Views per route (0.4, opt-in) |
| ---------------- | ----------------------- | ----------------------------- |
| 7 (the example)  | 241 KB / 74 KB gzip     | 234–237 KB / 74–75 KB gzip    |
| 37 (+30 pages)   | 605 KB / 95 KB gzip     | 238 KB / 75 KB gzip           |

With per-route loading a page's cost no longer grows with the number of pages.
The server preloads the page's chunk, so the lazy load does not delay
hydration: on the example, hydration starts about 23 ms after navigation
begins. CI checks that no page requests another page's view before it
hydrates. `<Link prefetch>` fetches a page's segment and code on hover, so the
click itself waits for nothing. See [Upgrading from 0.3](/migration/0.3-to-0.4) to opt in.

## Development loop

Time from saving a view to the edit appearing in server-rendered HTML:

| Command              | Latency     | NestJS restart |
| -------------------- | ----------- | -------------- |
| `nest start --watch` | 0.77–0.82 s | yes            |
| `nestjs-ssr dev`     | 0.13–0.2 s  | no             |

In the open page, through Vite HMR, the edit shows in about 0.2 s. CI runs this
loop on the example and fails if a view edit takes over 2 s to appear or
restarts Nest.

The gap grows with your application's boot time, and state held in memory
(connections, caches, gateways) survives view edits.

## Toolchain (for contributors)

The repository builds with TypeScript 7, tsdown and oxlint:

| Task      | 0.3.31 | 0.4    |
| --------- | ------ | ------ |
| typecheck | 1.33 s | 0.23 s |
| build     | 2.14 s | 0.27 s |
| lint      | 2.38 s | 0.26 s |
