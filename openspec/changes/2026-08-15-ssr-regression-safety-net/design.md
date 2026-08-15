# Design

## Principle

Each of the nine past fixes was found by a human running the app. The goal is not more tests — `3e5a3bf` already shipped 306 lines of exactly the right test — but tests that **execute** and that **cannot pass while the bug is present**. Both failed here: the good tests never ran, and the one that ran tested a copy of the code.

So every item below is judged on one question: *would this have failed on the commit before the fix?*

## Decision 1 — One composition function, not two that "must match"

**Problem.** `entry-server.tsx:36` and `entry-client.tsx:79` each define the layout-wrapping algorithm. Both must emit identical DOM including the `data-layout`/`data-outlet` wrapper divs. Four of five hydration bugs were drift between them. A third copy lives in the spec file, which is why the spec kept passing.

**Decision.** Export a single `composeWithLayouts` from the package (`@nestjs-ssr/react/client`, which both templates already import for `PageContextProvider`). Both entries import it. The spec imports the same export.

**Why this path.** The templates are copied verbatim into user projects by `npx @nestjs-ssr/react init`, so they can only import from the package's public exports — not from a relative `src/` path. `./client` is already a proven import in both files, so no new resolution surface. Existing user projects are unaffected: their copied templates are self-contained and keep working.

**Consequence.** The `data-layout`/`data-outlet` markup, the reverse-iteration order, and the `displayName || name || 'Layout'` naming become impossible to diverge. That structurally retires `71d1bc4`, `d283a48`, and the composition half of `b9bd070`.

**What it does not fix.** Layout *chain assembly* still differs by necessity — the server gets layouts from the interceptor, the client rebuilds them from `window.__LAYOUTS__` plus the `componentMap`. That is where `3e5a3bf` lived, and no refactor removes it. It needs Decision 2.

## Decision 2 — Parity test: real server output, real client hydration, fail on mismatch

React reports hydration mismatches as `console.error`. The test makes that fatal.

Per case:

1. Build props/context/layout chain for the case.
2. Render through the **real** server path → HTML string.
3. Set `document.getElementById('root').innerHTML` to that string; set `window.__COMPONENT_NAME__`, `__INITIAL_STATE__`, `__CONTEXT__`, `__LAYOUTS__`, `__MODULES__` as the template parser would.
4. Run the **real** client composition and `hydrateRoot`, flush effects.
5. Fail if any `console.error` matched a hydration-mismatch signature, or if post-hydration `innerHTML` differs from the server string.

**Why both assertions.** The console check catches what React notices; the HTML comparison catches silent structural drift React tolerates but client navigation does not.

**Environment.** happy-dom, already the vitest environment. No browser needed, so this runs in the existing 1.2s unit job on every commit and every pre-commit hook — the tier that actually gates work today.

**Cases** (each maps to a past bug or a documented behavior):

| Case | Guards |
|---|---|
| No layout | baseline |
| Root layout only | `71d1bc4` |
| Root + controller layout | `3e5a3bf` |
| Root + controller + method layout | `d283a48` |
| 3-deep nested layouts | `d283a48` |
| `layout: false` (skip controller) | documented behavior |
| `layout: null` (skip all) | documented behavior |
| Component with static `.layout` property | `entry-client.tsx:89` branch, server has no equivalent |
| kebab-case view filename | `b956ea2` |
| Component using `usePageContext()` | `b9bd070` |

The static-`.layout` case deserves emphasis: the client walks a `.layout` chain when `layouts` is empty (`entry-client.tsx:89-98`) and the server has **no such branch**. Today that is reachable only when `__LAYOUTS__` is absent, so it is latent rather than broken — the parity test pins it either way.

**Known asymmetry to encode.** `entry-client.tsx:153` wraps in `<NavigationProvider><PageContextProvider>`; `entry-server.tsx:81` wraps in `PageContextProvider` alone. Both are context-only and emit no DOM, so it is benign today. The parity test makes it stay benign instead of relying on nobody adding a wrapper element to `NavigationProvider`.

## Decision 3 — Minification is a separate axis

`b956ea2` is invisible to every test above, because dev builds keep function names. Two layers:

- **Unit**: drive `buildComponentRegistry` / `resolveViewComponent` with production-shaped input — default export named `t`, source file `login-page.tsx`, server-sent name `LoginPage`. Fast, runs everywhere.
- **Real**: the prod-mode Playwright run from Decision 5 exercises actual Vite minification. The unit test pins the resolution rule; only the prod run proves Vite still mangles the way we assume.

## Decision 4 — Hot reload needs a real process, not a mock

The `vite-initializer` unit tests are mock-based and thorough. They cannot catch what actually broke twice: **Vite changing its own semantics** (`hmr:{port:0}` meaning "random port" in Vite 7 and "unset → bind 24678" in Vite 8). No mock of Vite can report that Vite changed.

**Decision.** Commit the verification `ebec8a9` performed by hand. Boot the minimal fixture under `nest start --watch`, attach a browser, then loop N times: touch a source file, wait for respawn, assert the new process serves `:3000` within a timeout and that no `EADDRINUSE` appeared in output.

**The browser is not optional.** `c2db432` was specifically about sockets the HTTP server has *upgraded* — the proxied HMR WebSocket. Without a real browser holding that socket open, the failing condition does not exist and the test passes against the broken code.

**Placement.** Too slow and too timing-sensitive for every PR. Nightly, plus required on any PR touching `vite`. A flaky test in the required path gets disabled within a month, which would put us back at zero.

## Decision 5 — Run what already exists

The single highest-value item, and nearly free: a CI job that runs `test:integration:setup` then `:dev` and `:prod`, plus the e2e suite. Everything above is optional decoration until this lands, because `3e5a3bf` proves that writing the correct test is not sufficient.

Append-only edit to `ci.yml` (new job at end of file, no changes to existing steps) so it does not conflict with in-flight `actions/*` version bumps.

Fixture creation shells out to `nest new`, which is slow — cache `test/integration/fixtures` and `test/e2e/fixtures` keyed on the setup scripts and lockfile.

## Decision 6 — Stop hiding the templates from coverage

`vitest.config.ts` excludes `src/templates/**` as "Static HTML template". It is not static: it is 331 lines of the most bug-dense code in the package. Remove the exclusion once Decisions 1–2 land and re-baseline thresholds upward.

## Sequencing

1. Decision 5 (CI) — largest effect, smallest diff, unblocks validation of everything else including PR #113
2. Decisions 1 + 2 together — the refactor is only safe behind the parity test, and the parity test is only meaningful against the shared function
3. Decision 3 — small, independent
4. Decision 4 — largest effort, and the only one that needs new infrastructure
5. Decision 6 — bookkeeping, last

## Rejected alternatives

- **Snapshot the SSR HTML.** Catches server changes, not server↔client divergence. Both files can drift together and the snapshot just gets updated.
- **Assert the two source files are textually identical.** Brittle and wrong; they legitimately differ in how the layout chain is assembled.
- **Full browser test for every hydration case.** Correct but far too slow for the pre-commit tier, which is where this must fail to change behavior. The Playwright suites stay as the integration-level check; happy-dom carries the matrix.
