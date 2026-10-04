# Proposal

## Why

`packages/react/test/example/dev-loop.spec.ts` (`EXAMPLE_MODE=dev pnpm
test:example`) is intermittently red. Verification for
`2026-09-28-render-pipeline-hardening` task 1.6 ran it three times each in
two clones — one with Group 1 applied, one with Group 1 reversed — and saw
both fail at least once: pass/fail/pass in one clone, fail/fail/pass in the
other, no deterministic split by clone (full detail in that change's
verification notes, 2026-09-29). So the flake predates Group 1 and isn't
caused by it; it's a standing gap in the suite that happens to have been
noticed during an unrelated change.

Both observed failure shapes point the same direction:

- `a view edit updates the page ...`: the Vite-HMR assertion in the browser
  passes inside its 2 s budget, but the very next check —
  `serverHtml('/recipes')`, a single unretried fetch — still returns
  pre-edit HTML.
- `a service edit restarts Nest`: times out waiting for the runner's own
  `Restarting Nest` log line, even though Nest's own logs show it started
  and restarted fine — the *detection* of the restart is what's late, not
  the restart itself.

`src/cli/dev.ts:214` detects both view and service changes with Node's
`fs.watch(outDir, { recursive: true })` over the compiled output directory,
which on macOS is backed by FSEvents. Recursive FSEvents watches have
known, load-dependent latency and coalesce bursts of events — exactly the
kind of delay that would race a fixed 2 s budget and an un-retried fetch, or
occasionally miss a 30 s window under load. The test file's own
`waitFor` helper (`:40-52`) already exists for log-line waits but the
`serverHtml` check on line 116 that confirms the view edit landed is not
wrapped in it.

This change investigates and hardens; it does not assume the fix in
advance. The two candidates are not mutually exclusive: give the test more
margin (retry `serverHtml`, raise budgets) and/or replace the raw recursive
`fs.watch` restart-detection in `dev.ts` with something that doesn't
coalesce/delay under load (e.g. per-file watches, a debounce tuned to
measured latency, or a different file-change primitive). Task 1 decides
which, with data, before anything is implemented.

## What Changes

- Reproduce the flake with timing instrumentation around the FSEvents
  watch-to-detection path, to measure actual latency distribution rather
  than inferring it from timeouts
- Based on that data, decide: harden the test (retry margin) and/or replace
  `dev.ts`'s raw recursive `fs.watch` restart detection
- Implement the chosen fix(es)
- Verify with N consecutive clean runs of `dev-loop.spec.ts`, not just one

## Capabilities

### Modified Capabilities

None yet — this change's own task 1 (investigation) determines whether the
fix lands in the test (`dev-loop.spec.ts`) only, in `dev.ts`'s
restart-detection mechanism, or both. No capability spec describes
dev-loop restart detection today; if the investigation concludes a
behavioral change to `dev.ts` is warranted, add the relevant spec delta at
that point rather than guessing its shape now.

## Impact

- `packages/react/test/example/dev-loop.spec.ts` — likely touched (retry
  margin and/or budget changes)
- `packages/react/src/cli/dev.ts` — possibly touched (restart-detection
  mechanism), only if task 1's data supports it
- No public API or dependency change anticipated; if the chosen fix adds a
  dependency (e.g. a watch library), that is decided and justified in task
  1, not assumed here

## Non-goals

- Implementing a fix before task 1's timing data exists
- Fixing any other flaky suite — this change is scoped to `dev-loop.spec.ts`
  and the restart-detection path it exercises
- Changing HMR/view-update behavior itself, only how reliably its signal is
  observed
