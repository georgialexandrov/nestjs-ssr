# Performance

Numbers from the repository's own harnesses, on `examples/minimal` (Apple
silicon, Node 26, NestJS 12). They are guides, not guarantees: measure your
own application the same way.

## Server rendering cost

Server CPU per request, measured inside the NestJS process (`process.cpuUsage()`
diff over a fixed load window: 20 concurrent fetch loops, 1 s warm-up, 3 s
measured), minimum of 10 rounds, one harness with three builds interleaved
round-robin:

| CPU µs/request (min of 10)                  | 0.3.31 | 0.4 without JSON fast path | 0.4          |
| ------------------------------------------- | ------ | -------------------------- | ------------ |
| SSR `/recipes`                              | 168.5  | 153.8                      | 141.5 (−16%) |
| SSR, 50-item list page                      | 1004   | 809                        | 673 (−33%)   |
| JSON `/recipes`                             | 79.1   | 64.7                       | 65.8 (−17%)  |
| SSR, small page whose props contain `Date`s | 62.7   | 66.8                       | 66.4 (+6%)   |

Percentages are against 0.3.31. Measured 2026-09-28 on `examples/minimal`;
0.3.31 is the npm-published package with a 2-line `__dirname` shim so its ESM
build can start — the ESM `ReferenceError` the migration guide lists as fixed
in 0.4. Noise floor: identical code measured 0.6% apart between rounds, so the
Date page's +6% is a real regression rather than noise; it is under
investigation, not yet explained. The step-by-step measurements this single
run replaces — each optimization compared against the one before it, across
separate runs, which overstated the cumulative gain — are kept for history in
"Measured reality" in `openspec/changes/nest-12-platform/design.md`.

The payload snapshot matters more as pages carry more data, and the JSON fast
path shows the same shape: on the pipeline micro-benchmark, whose page props
are a 50-item list, a server-rendered response went from 150 µs to 106 µs
(−30%, a different, labelled harness — see `pnpm bench` below); the JSON fast
path itself, comparing the 0.4 and "0.4 without JSON fast path" columns above,
is −8% on SSR `/recipes`, −17% on the 50-item list, and no change on the Date
page (the fast path doesn't apply, so the same devalue path runs as before).

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
JSON (0.47 on `/recipes`); CI fails the build if that drops below 0.40.

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
