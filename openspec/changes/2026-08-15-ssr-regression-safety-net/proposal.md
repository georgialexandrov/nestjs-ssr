## Why

Two bug families have each been "fixed" repeatedly, and in both cases the user found the bug by running the app — never a test.

**Hydration (5 fixes).** `b9bd070`, `71d1bc4`, `d283a48`, `3e5a3bf`, `b956ea2`. Every one was a divergence between two independent copies of the same algorithm: `composeWithLayouts` in `src/templates/entry-server.tsx` and `composeWithLayout` in `src/templates/entry-client.tsx`. They must emit byte-identical DOM, and nothing enforces it.

**Hot reload (4 fixes).** `acb8a65`, `1438f59`, `c2db432`, `ebec8a9`. One cause: the Nest process embeds a second Vite server and proxies HMR, so on `nest start --watch` SIGTERM it must release port 3000, the HMR WebSocket port, and every socket — or the respawn dies with `EADDRINUSE`. The fixes regressed each other: `acb8a65` set `hmr:false` → broke Vite's lifecycle → `1438f59` set `hmr:{port:0}` → `c2db432` found `closeAllConnections()` misses upgraded sockets → `ebec8a9` found Vite 8 now treats `port:0` as unset, regressing `1438f59`.

Four verified reasons the existing tests never caught any of it:

1. **No CI job runs Playwright.** Grepping `.github/workflows/` for `playwright|test:e2e|test:integration` returns nothing; `lefthook.yml` pre-commit runs the same three steps as CI (unit, build, typecheck). The 306-line `test/integration/specs/layouts.spec.ts` — written as the regression guard for `3e5a3bf` — has never gated a commit. Neither have the five `test/e2e/specs/*`.
2. **The unit test is a third copy of the algorithm.** `src/__tests__/unit/compose-layouts.spec.tsx:16` states it: *"Extracted layout composition logic - must match entry-server.tsx and entry-client.tsx"*, then redefines `composeWithLayouts` locally and tests that. It passes forever while both real files drift. It cannot fail on the bug it was written for.
3. **The shipped templates are untested and unmeasured.** `src/templates/**` is excluded from coverage (`vitest.config.ts`), and no test imports them — the only reference anywhere is a path string in `render.service.ts`. Five of nine bugs lived in files with zero test reach.
4. **`b956ea2` was production-only.** Minified function names do not exist in dev, so dev-mode testing structurally cannot see that class of bug.

For hot reload the gap is different: unit coverage is good (a `hot-reload shutdown contract` block exists, 342 tests pass in 1.2s) but entirely **mock-based**. It locks in wiring and cannot catch Vite changing its own semantics — which is what broke it twice on version bumps. `ebec8a9` was verified against a real `nest --watch` + Chromium fixture at 8/8 restarts; that verification was discarded instead of committed.

## The suites are not just unrun — they are red

Measured 2026-08-15 on freshly regenerated fixtures: **34 passed, 6 failed**. The same three
interactivity-after-hydration tests fail in both the `string` and `stream` fixtures, because
`entry-client.tsx` dies with `TypeError: require_react is not a function` thrown from Vite's
optimized `react_jsx-dev-runtime.js` before `hydrateRoot` runs. The page renders correct SSR
markup and is completely inert.

The `no hydration mismatch warnings` test passes throughout — nothing hydrates, so nothing
can mismatch. That is the sharpest possible illustration of the problem this change exists to
fix: a green test sitting next to a dead page, in a suite nobody runs. Details and open
questions in `tasks.md`.

## What Changes

- Run the Playwright integration and e2e suites in CI, in both dev and prod modes
- Extract layout composition into one shared module imported by both entry templates, and delete the duplicate copies (including the one inside the spec)
- Add an SSR↔hydration parity test that renders with the real server composition, hydrates with the real client composition, and fails on any React hydration-mismatch console error
- Add minified-shape tests for component/layout name resolution
- Add a hot-reload restart-loop test that drives a real `nest --watch` cycle with a browser attached, run nightly rather than per-PR
- Require the browser and restart jobs on dependency PRs that touch `vite`
- Drop the `src/templates/**` coverage exclusion

## Capabilities

### New Capabilities

- `ssr-regression-safety-net`: Executable guarantees that server and client render identically, that the dev server survives hot-reload restarts, and that both are enforced in CI

### Modified Capabilities

None. This change adds enforcement; it does not alter rendering behavior.

## Impact

- **CI**: new browser job per PR (~several minutes, fixture-cached); new nightly restart job
- **`packages/react/src/templates/entry-server.tsx`, `entry-client.tsx`**: both import shared composition instead of defining it. These templates are copied into user projects by `npx @nestjs-ssr/react init`, so the import must resolve through the published `./client` export — existing user projects keep working because their copied templates are self-contained.
- **`src/__tests__/unit/compose-layouts.spec.tsx`**: local algorithm copy deleted, retargeted at the real export
- **`vitest.config.ts`**: coverage exclusion removed; thresholds re-baselined
- No public API change, no dependency change

## Coordination

- Another agent is merging dependency-bump PRs. CI changes here are **append-only** (a new job at the end of `ci.yml`, no edits to existing steps) so they merge cleanly against `actions/*` version-bump line edits. No `package.json` dependency ranges are touched.
- PR #113 (`nest-cli.json` SSR path resolution) refactors production path resolution and the embedded Vite server config. It should be validated by the CI job from task 1 rather than merged on unit tests alone. Its `configFile: false` on the embedded Vite server creates a server/client Vite-config divergence — the same mechanism as the hydration family — and should be resolved before merge.

## Non-goals

- Fixing any currently-open bug. This change only adds detection.
- Reworking the mock-based `vite-initializer` unit tests, which are good at what they do.
