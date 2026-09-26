# Performance

Numbers from the repository's own harnesses, on `examples/minimal` (Apple
silicon, Node 26, NestJS 12). They are guides, not guarantees: measure your
own application the same way.

## Server rendering cost

Server CPU per request, measured inside the NestJS process (interleaved A/B
runs, minimum of several runs so other load on the machine cannot inflate it):

| Version                                     | SSR `/recipes` | JSON `/recipes` |
| ------------------------------------------- | -------------- | --------------- |
| 0.3.31                                      | 163–171 µs     | 87–90 µs        |
| 0.4: single-pass payload snapshot           | 145–146 µs     | 77–79 µs        |
| 0.4: server bundle imported once            | 140 µs         | 77–79 µs        |
| 0.4: one-pass hydration-state serialization | **~135 µs**    | 77–79 µs        |

About 19% less CPU per server-rendered page. Every change produces
byte-identical responses: the old implementations are kept as test oracles and
tens of thousands of random payloads must match them exactly.

What remains, per request: React's `renderToString` (~35 µs), serialization of
the hydration state, the payload snapshot that keeps domain objects out of the
client payload, and HTTP/Express/Nest overhead.

Run it yourself:

```bash
cd packages/react
pnpm perf:http            # builds the example, loads it, reports CPU/request
pnpm bench                # pipeline micro-benchmark
```

## Client JavaScript per page

Initial JavaScript a page downloads, including React:

| Views in the app | All views bundled (0.3) | Views per route (0.4, opt-in) |
| ---------------- | ----------------------- | ----------------------------- |
| 7 (the example)  | 241 KB / 74 KB gzip     | 234–237 KB / 74–75 KB gzip    |
| 37 (+30 pages)   | 605 KB / 95 KB gzip     | 238 KB / 75 KB gzip           |

With per-route loading a page's cost no longer grows with the number of pages.
The server preloads the page's chunk, so the lazy load does not delay
hydration. See [Upgrading from 0.3](/migration/0.3-to-0.4) to opt in.

## Development loop

Time from saving a view to the edit appearing in server-rendered HTML:

| Command              | Latency     | NestJS restart |
| -------------------- | ----------- | -------------- |
| `nest start --watch` | 0.77–0.82 s | yes            |
| `nestjs-ssr dev`     | 0.13–0.2 s  | no             |

The gap grows with your application's boot time, and state held in memory
(connections, caches, gateways) survives view edits.

## Toolchain (for contributors)

The repository builds with TypeScript 7, tsdown and oxlint:

| Task      | 0.3.31 | 0.4    |
| --------- | ------ | ------ |
| typecheck | 1.33 s | 0.23 s |
| build     | 2.14 s | 0.27 s |
| lint      | 2.38 s | 0.26 s |
