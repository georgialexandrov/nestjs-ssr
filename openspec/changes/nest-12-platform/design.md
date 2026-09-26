## Context

This change produces 0.4.0 on branch `feat/nest-12` and adds Nest 12 support while keeping Nest 11 working. **Hard constraint: full backwards compatibility with 0.3.31** — no public API, export, output format, response behavior or generated-file contract may break; new behavior that needs new generated code is opt-in or falls back. Breaking changes are deferred to a later change. The motivation and the scope decisions already made (Nest 12 only, ESM-only, TypeScript 7, oxlint, pnpm 12, and the performance and look-and-feel surfaces) are in `proposal.md`.

### Baselines (2026-09-26, Apple silicon, Node 26.8.1)

All numbers are from the `examples/minimal` production build under `autocannon -c50 -d10`.

| Metric                                                                    | Baseline                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------- |
| SSR `GET /recipes`                                                        | 6,481 req/s · p50 7 ms · p99 14 ms                    |
| SSR `GET /`                                                               | 7,395 req/s                                           |
| JSON `GET /recipes` (same data)                                           | 13,904 req/s · p50 3 ms                               |
| CPU share: `@nestjs-ssr/react` / `clonePublicGraph` / devalue / react-dom | 60.4% / 49.5% / 9.5% / 6.2%                           |
| Pipeline micro-bench, HTML vs JSON median                                 | 325 µs vs 6 µs                                        |
| Client vendor chunk                                                       | 219 KB raw / 67.5 KB gzip                             |
| Client app + lib chunk                                                    | 27.9 KB raw / 8.4 KB gzip (all views eager)           |
| Server package Core                                                       | 29.6 KB brotli (limit 30 KB); dist 972 KB (CJS + ESM) |
| Library typecheck                                                         | 1.33 s on TS 6 vs 0.97 s on TS 7                      |
| Build / test / lint                                                       | tsup 2.14 s · vitest 2.68 s · eslint 2.38 s           |

### Where the time goes

- **Payload graph.** Every HTML request runs `projectContext` and `projectPageData` (`src/render/pipeline/public-payload.ts`). Each one:
  - deep-clones the graph with `Object.create(proto)` plus a per-key `Object.defineProperty`, which pushes V8 objects into slow dictionary mode;
  - walks the graph again to validate it, and again to deep-freeze it;
  - hands the result to React and devalue, which walk it once more.

  That is four or more full passes per payload, and the clone produces the slowest possible objects for every later pass to read.

- **Client entry.** `entry-client.tsx` uses `import.meta.glob(..., { eager: true })` for all views, so the client bundle grows with every page an app adds.
- **Dev loop.** Controllers import view components for `@Render(Component)`. Editing a `.tsx` view makes `nest start --watch` recompile and restart the process, so a view edit costs a full Nest restart instead of an HMR update.

### Constraints

- The repo's 7-day `minimum-release-age` gate and exact pins stay. `@nestjs/*` 12.0.3 is installable today; 12.1.0 becomes installable on 2026-09-30.
- The 0.3.31 security guarantees must hold: projection allowlist, serialization guards, warn/enforce limits, and non-executable serialization.
- The browser suites (integration and e2e, dev and prod) stay the release gate.

## Goals / Non-Goals

**Goals:**

- Nest 12 support alongside Nest 11 (peers `^11 || ^12`, both in CI), and TypeScript 7 + pnpm 12 for the repo's own toolchain, keeping the dual ESM/CJS package output.
- Server: SSR throughput on `/recipes` ≥ **1.8×** baseline (≥ 11,650 req/s on the reference machine), p99 no worse than baseline, and pipeline micro-bench HTML median ≤ **60 µs**.
- Client:
  - initial JS for a single-page visit ≤ vendor + runtime + **that route's chunk only**;
  - hydration start no later than baseline on the example, as measured by the Playwright hydration mark;
  - no navigation regression.
- Dev: a view or layout edit is visible on the next request or HMR update **without a NestJS restart**, with edit-to-update ≤ **500 ms** on the example.
- Tooling: typecheck, build and lint each at least 2× faster than baseline.
- Look and feel: a redesigned starter, dev error page, `init` CLI and docs site.
- Every numeric target is recorded in the repo and enforced in CI with a tolerance, not asserted once.

**Non-Goals:**

- React Server Components, streaming HTML partial hydration, islands, or a new routing model.
- Replacing devalue or React's renderer.
- Changing the `@Render`, `@Layout`, `RenderModule` or hooks public APIs beyond what Nest 12 or ESM forces.
- Any breaking change: dropping Nest 11, ESM-only output, removing exports or options, or requiring users to edit files. These belong to a later change.
- Replacing Vite; adopting Rspack for the library or example build.
- A visual design system for users' apps beyond the starter template.
- Archiving or re-litigating `secure-response-negotiation` beyond moving its specs into `openspec/specs/`.

## Decisions

### D1. Toolchain: TypeScript 7 first, a TS 6 API only where proven necessary

TypeScript 7 is installed as `typescript` and used for `tsc --noEmit` everywhere. `@typescript/typescript6` is added under an alias only for a consumer that is confirmed to fail without the classic API.

Expected consumers:

- The `nest build` / Nest CLI 12 builders: the CLI bundles its own TS ~6.0, so no alias should be needed.
- api-extractor bundles TS 5.9, so it is unaffected.
- vitepress, if its type integration needs the classic API.

**Why:** Aliasing `typescript` globally to 6 would silently keep the slow compiler everywhere. Scoped aliases keep TS 7 as the default.

**Alternatives:**

- Stay on TS 6 until 7.1 ships its API. Rejected; the user asked for 7.
- Use `@typescript/native-preview`. Rejected; 7.0 is GA.

### D2. Build with tsdown, dual output kept

`tsup.config.ts` becomes `tsdown.config.ts`, with entries for index, client, render and cli, `format: ['esm', 'cjs']` producing the same file names as today, and `.d.ts` generation through oxc isolated declarations (TS-7-safe). The export map is unchanged; a test compares the packed tarball's file list and export map against 0.3.31. Templates are copied by a tsdown hook.

**Why:** tsup is unmaintained (last release Nov 2025), and its `.d.ts` build needs the TS classic API. tsdown is Rolldown-based, matching Vite 8, and accepts TS `^7`.

**Isolated declarations:** these require explicit return types on exported symbols. oxlint's `isolated-declarations`-style checks enforce that, and api-extractor's report guards against public-API drift.

**Alternatives:**

- `tsc` emit plus a bundler. Rejected: two tools, slower.
- `unbuild`. Rejected: less aligned with Rolldown.

### D3. Lint with oxlint + oxlint-tsgolint

`.oxlintrc.json` ports the current ESLint rules, including the `no-unsafe-*` family through type-aware tsgolint, which runs on TS 7 natively. ESLint, typescript-eslint and their config are removed. The lefthook `lint` command and the CI `lint` job switch to `oxlint --type-aware`.

Rules with no oxlint equivalent are listed in the task and either dropped with justification or covered by dependency-cruiser or knip.

**Alternative:** ESLint on a TS 6 alias. Rejected by the user.

### D4. pnpm 12 migration

- `packageManager` becomes `pnpm@12.6.0`.
- `minimum-release-age` moves from `.npmrc` to `minimumReleaseAge: 10080` in `pnpm-workspace.yaml`. `.npmrc` keeps only registry and auth settings, or is deleted.
- `onlyBuiltDependencies` and `ignoredBuiltDependencies` fold into `allowBuilds`.
- Any `npm_config_*` environment variables in scripts or CI become `pnpm_config_*`.

`pnpm/action-setup` is verified to install pnpm 12 from `packageManager`. If v5.0.0 can't, the pin moves to the v6 commit, and that commit is verified rather than taken from a tag.

Run pnpm's migration codemod first, then review its diff by hand.

### D5. Nest 12 migration of the library

Peers become `^11.0.0 || ^12.0.0`. `@nestjs/*` dev deps become 12.0.x (12.1.x once it passes the gate), and a CI job runs the unit and browser suites against Nest 11.2.x as well, so both majors stay green.

Behavior changes to audit in library code, each with a test:

- `@Optional()` is no longer inherited. Check every `@Optional` in `RenderModule` providers and any subclassing.
- Lifecycle hook ordering by hierarchy. Affects `ViteInitializerService` `onModuleInit` / `onApplicationShutdown` relative to user modules; the dev proxy registration order matters.
- `UnknownDependenciesException` replaces silent `undefined`. Affects optional tokens: `CONTEXT_PROJECTOR` and the context factory.
- The Express adapter drains in-flight requests on shutdown. Affects the stream-mode abort and the render-scope timers.
- `ConsoleLogger` structured params. Our logger calls pass objects after messages in places; format them as strings or keep structured output deliberately.

Fastify: the adapter version follows 12.x; the `@nestjs/platform-fastify>fastify` and `multer` overrides are re-evaluated and removed if 12.x ships fixed versions.

**Example and fixtures:**

- `examples/minimal` moves to Nest 12. Jest is replaced by Vitest (Nest 12's ESM default); the `start:dev` scripts stay.
- `create-fixtures.ts` (integration and e2e) runs the Nest 12 CLI `nest new`. The CI Node matrix drops versions below the CLI minimum (22.22.3 / 24.15 / 26).

### D6. Server performance: a single-pass snapshot replaces clone → validate → freeze

A new `snapshotPublicGraph(value, { limits, target, label, mode, dev })` walks the graph **once**. In that one pass it:

- enforces type, depth, byte-estimate and cycle rules (the existing `validatePublicPayload` logic, inlined);
- builds the detached copy;
- for plain objects (`Object.prototype` or `null` proto), builds the copy by literal construction (`const out = {}; out[k] = …`), so V8 keeps fast hidden classes, and uses a pre-sized `new Array(n)` for arrays;
- handles non-plain prototypes (class instances) exactly as today;
- tracks cycles and shared references with a `Map` created only when the graph is deeper than one level, so the common flat-props case allocates nothing extra.

Freezing:

- **Development:** the snapshot is deep-frozen, so a component or late stage that mutates props throws, with a diagnostic naming the path.
- **Production:** no freeze. Isolation is guaranteed because nothing outside the renderer holds a reference to the snapshot. The controller's object is never shared with the render or the client payload.

The security requirement changes accordingly (see the delta spec). No existing test that asserts "a controller mutation after return does not reach the client" may change. Tests that assert `Object.isFrozen` in production are rewritten to the development-only guarantee.

**Why it's safe:** The guarantee users rely on is that domain objects and later mutations never leak to the client. Detachment provides that. Freezing only protects against _our own_ later stages adding fields, which is covered by the single payload boundary and by the dev-mode freeze in CI's browser suites.

**Further hot-path items, each benchmarked separately:**

1. The template is precompiled once per template version into static segments plus slot indexes. `injectPlaceholder` (4.7%) becomes an array join.
2. The layout chain is resolved per route and cached per `(handler, layoutOverride)` key instead of per request.
3. Head tags are rendered from a per-route template when `head` is static.
4. `context` projection is skipped when no `projectContext` hook is configured and the context holds only allowlisted primitives. The snapshot is still taken, but through the flat fast path.

**Alternatives:**

- Keep the clone but make it faster (a literal copy without the single pass). This is the fallback if the single-pass merge makes the validator harder to audit.
- `structuredClone`: slower than a literal copy for small graphs and loses prototypes.
- Serialize first and render from the parsed copy: an extra parse, and React would render from a different object than the controller saw in dev.

### D7. Client performance: per-route code splitting with server-side preload

The `entry-client.tsx` template switches views to `import.meta.glob(..., { eager: false })`. Layouts stay eager: they're few, and they're needed on every route.

- The server knows the rendered component's source module in dev (Vite module graph) and prod (Vite manifest `src` → `file` + `imports`). It emits `<link rel="modulepreload">` for the route chunk and its imports, plus its CSS, in the head.
- On boot, the client awaits only the current route's chunk, whose download started in parallel with the entry.
- Client-side navigation prefetches the target route's chunk on link hover or focus (`Link` already exists), then fetches the segment.
- The kebab-case → PascalCase normalization spec keeps working, because the lookup keys are unchanged; only the values become loaders.

**Component → module mapping:** a small Vite plugin in the generated `vite.config` stamps each view's default export with its module id (`Component.__ssrModuleId`). The render service reads it to find the manifest entry. That replaces name-based guessing and also serves D8. Existing projects that don't regenerate their config fall back to the current eager behavior; a dev-time warning says so.

**Alternatives:**

- React `lazy()` + Suspense on the client. Rejected: it causes a hydration mismatch unless the chunk is already loaded, which the preload guarantees anyway.
- Route manifests emitted by the library. Rejected: more build coupling than a Vite plugin.

### D8. Dev loop: view edits without a Nest restart

In development the render service renders the component from `vite.ssrLoadModule(Component.__ssrModuleId)`, which is always the latest source. It ignores the tsc-compiled import the controller holds, which serves only as a typed token.

The Nest watcher is told to ignore `**/views/**`. Either Nest CLI 12 watch options or the builder's `watchOptions.ignored` do this; the spike decides which (see Open Questions). Views are still type-checked by `tsc --noEmit --watch` running alongside, or by the IDE.

Client HMR already works through Vite. With the server no longer restarting, the websocket stays up and React Fast Refresh applies edits.

**Fallback if the spike fails:** run the Nest app inside Vite's module runner in dev (Vite Environment API), which gives HMR for server modules generally. This is larger, so it's only used if the watcher-ignore approach can't be made reliable.

**Alternatives:** keeping restarts and making them faster (Nest 12 plus the swc builder). Rejected: it's still a restart, the socket drops, and state is lost.

### D9. Look and feel

- **Starter** (`init` output):
  - one root layout with CSS custom-property tokens and light/dark themes through `prefers-color-scheme` plus a toggle using a cookie, which shows off `useCookie`;
  - a welcome page explaining the request → controller → `@Render` → hydration flow, with links to the docs;
  - a sample `@Layout` controller;
  - no CSS framework dependency; one plain CSS file of 5 KB or less.
- **Dev error page:** rebuilt as a self-contained component (inline CSS, dark and light). It shows:
  - the error message and name;
  - a source-mapped code frame using Vite's `ssrFixStacktrace` and a source excerpt;
  - the React component stack;
  - route, controller and method, and the component module id;
  - copy-to-clipboard for the full report;
  - "open in editor" through Vite's `/__open-in-editor` endpoint.

  The production error page is unchanged in content. A test asserts that no stack, path or source is ever emitted when not in development.

- **CLI (`init`):** uses `@clack/prompts`, a small ESM prompt library that doesn't hijack the terminal. It:
  - detects the package manager from the lockfile or user agent;
  - asks for SSR mode, example pages, and whether to install now;
  - shows a spinner per step;
  - ends with a boxed next-steps summary.

  `--yes` and explicit flags (`--mode`, `--pm`, `--skip-install`, `--no-examples`) make it fully non-interactive, with non-TTY detection. Running it twice is idempotent: existing files are detected and skipped unless `--force`.

- **Docs:**
  - a new landing page;
  - getting started for Nest 12;
  - a "Performance" page showing the harness, the reference machine and before/after numbers;
  - the 0.3 → 0.4 migration guide.

  Evaluate VitePress 2 on a time-box. If it's not stable, stay on 1.6.4 with the existing vite override.

### D10. Performance budgets in CI

- **Micro-bench:** `pnpm bench` stays. `baseline.json` is re-recorded after D6 lands; tolerance stays 2.5× on CI runners and 1.3× locally.
- **E2E throughput (`test/perf/http.ts`):** builds the example in production mode and runs autocannon against `/`, `/recipes` and JSON `/recipes`.
  - CI gates on a **ratio** (SSR req/s ÷ JSON req/s on the same runner), not absolute req/s, so runner variance cancels out. Baseline ratio is 0.47; the target is ≥ 0.80.
  - Absolute numbers are printed for the docs page.
- **Client:** size-limit entries for the example's entry, vendor and per-route chunks, plus a Playwright test recording `performance.mark` around hydration. It gates on "hydration start ≤ baseline + 10%".
- **Dev loop:** a Playwright dev-mode test edits a view file and asserts that the DOM updates within 2 s, and that the Nest process PID didn't change. The 500 ms target is reported but not gated, because CI is too noisy for that.

## Risks / Trade-offs

- **Freezing only in dev lets a production-only mutation bug slip through** → The snapshot is still detached, so a mutation can't leak domain data. Browser suites run dev mode with freeze on. The spec states the development-only guarantee explicitly.
- **TS 7 isolated declarations need explicit return types** → Churn in public API files. api-extractor's report catches accidental API changes.
- **oxlint rule parity gaps** → Map rules one to one in a table in the task. Missing ones are covered by tsgolint type-aware rules, knip or depcruise, or accepted in writing.
- **One codebase for two Nest majors** → Behavior differences (for example `@Optional()` inheritance and lifecycle ordering) are handled so the library works identically under both, and a Nest 11 CI job guards it.
- **The `__ssrModuleId` plugin is new coupling between the generated `vite.config` and the library** → Fall back to eager loading and restart-on-edit when the stamp is missing, with a one-time dev warning. `init` and the migration guide add the plugin.
- **The watcher-ignore approach may not exist or be reliable across the Nest CLI 12 builders (tsc, swc, rspack)** → Spike first (task 5.1) and fall back to the Vite module runner. Don't block the release on the dev-loop goal: it can ship in 0.4.x if the spike overruns.
- **Nest 12 lifecycle ordering changes dev proxy registration** → Covered by the dev browser suites. Add an explicit test that the Vite proxy middleware is registered before user routes.
- **Performance numbers depend on the machine** → CI gates on ratios. Docs state the reference machine.
- **Rollback** → Each phase lands as its own PR onto `feat/nest-12` with green CI. `main` stays on 0.3.x until 0.4.0 is released. After release, rollback is `npm dist-tag add @nestjs-ssr/react@0.3.31 latest`, plus a 0.4.x patch.

## Migration Plan

1. **Phase 0 (on `main`, before branching work):** archive `secure-response-negotiation` so its specs exist in `openspec/specs/`. Commit the perf harnesses, record baselines, then rebase `feat/nest-12`.
2. **Phases 1–7** land on `feat/nest-12` as separate PRs in order: toolchain → Nest 12 → server perf → client perf → dev loop → look and feel → release. Each is green on the full CI plus browser suites.
3. **Release:** 0.4.0 via the release workflow with `explicit-version=0.4.0`. The migration guide is published with it. `latest` moves to 0.4.0, and 0.3.x stays installable for Nest 11 users.
4. Close Snyk PR #138 as superseded.

## Open Questions

- **Dev watcher (D8):** Which Nest CLI 12 builder option excludes `views/**` from restart triggers across tsc, swc and rspack? This is resolved by spike task 5.1.
- **Nest 12.1:** Does 12.1.x change any interceptor or `ExecutionContext` behavior we rely on? Re-check when it passes the release-age gate (2026-09-30).
- **VitePress:** Is 2.x stable enough for the docs refresh, or do we stay on 1.6.4? Time-boxed in task 7.x.
- **Context snapshot fast path:** Should the context snapshot be cached per request-shape when no projector is set? Decide after measuring D6 step 4.
