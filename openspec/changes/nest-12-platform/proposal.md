## Why

NestJS 12 is ESM-only, TypeScript 7 ships a native compiler with no classic JS API, and pnpm 12 moves most configuration out of `.npmrc`. Staying on the old stack would strand users as Nest 12 adoption grows.

Measurements taken on 2026-09-26 also show the library is its own bottleneck. On the example app, `@nestjs-ssr/react` accounts for 60% of server CPU under SSR load, and `clonePublicGraph` alone for 49.5%, while React rendering is 6.2%. SSR serves ~6.5k req/s against ~13.9k req/s for the same data as JSON. Every view is also bundled into one eager client chunk.

A breaking release is the right moment to fix the platform, the performance and the first-run experience together, and to measure all of it.

## What Changes

- Nest 12 support is added alongside Nest 11: the `@nestjs/*` peer range becomes `^11.0.0 || ^12.0.0`. Both are tested in CI.
- The TypeScript peer range widens to `^5 || ^6 || ^7`.
- **Backwards compatibility is a hard constraint for this change.** Dual ESM + CJS output, every export, every public API and 0.3.31 generated files keep working. Anything that needs new generated code is opt-in or falls back to today's behavior. Breaking changes, such as dropping Nest 11 or going ESM-only, are deferred to a separate, later change.
- Repo toolchain:
  - pnpm 12, with settings moved into `pnpm-workspace.yaml`.
  - TypeScript 7 for type-checking, plus a TS 6 API alias only for tools that still need it.
  - tsdown replaces tsup.
  - oxlint with type-aware rules replaces ESLint and typescript-eslint.
  - The example, CLI init templates and test fixtures move to Nest 12.
- Server performance: the public-payload boundary keeps its isolation guarantee, but through a single validate-and-serialize pass instead of clone, freeze and re-walk. Template injection uses precompiled segments.
- Client performance: views load per route (lazy), and the server `modulepreload`s the current route's chunk from the Vite manifest, so hydration is never delayed by the split.
- Dev loop: editing a view hot-updates the page without restarting NestJS.
- Look and feel:
  - A redesigned starter produced by `init`.
  - A rebuilt development error page.
  - An interactive, non-interactive-capable `init` CLI.
  - A refreshed docs site with a 0.3 → 0.4 migration guide and published benchmark numbers.
- Performance becomes a gated contract: an end-to-end throughput harness, client bundle and hydration metrics, and dev edit-to-update latency are committed, with CI budgets.

## Capabilities

### New Capabilities

- `platform-support`: The supported runtime matrix (Nest 11 and 12, TypeScript peer range), preservation of the dual ESM/CJS package contract, and the backwards-compatibility guarantee for 0.3.31 application code and generated files.
- `performance-budgets`: Benchmark harnesses (pipeline micro-bench, end-to-end HTTP throughput, client bundle size, hydration timing, dev edit latency), recorded baselines, and CI gates with tolerances.
- `route-code-splitting`: Per-route lazy view loading on the client, server-emitted preload hints for the active route, and hydration/navigation correctness with split chunks.
- `dev-view-hot-update`: In development, view and layout edits are applied through Vite HMR without restarting the NestJS process, and server-rendered output reflects the edited view on the next request.
- `dev-error-page`: The development render-error page: content, source mapping, component stack, route context, theming, and the guarantee that none of it is served in production.
- `project-scaffolding`: `init` CLI behavior (interactive and non-interactive modes, package-manager detection, idempotence, summary output) and the starter files it generates.

### Modified Capabilities

- `render-response-security`: "One public payload boundary" gains explicit snapshot semantics. The projected graph is detached from domain objects by a single validating copy that is frozen as it is built. Later mutations never reach the client. The isolation and immutability guarantees are unchanged. (This spec currently lives in the unarchived `secure-response-negotiation` change, which must be archived first.)

## Impact

- **Library code:**
  - `src/render/pipeline/public-payload.ts`, `safe-serialize.ts`
  - `template-parser.service.ts`, `render.service.ts`, `renderers/`
  - `vite-initializer.service.ts`
  - `src/render/error-pages/`
  - `src/templates/entry-client.tsx`, `entry-server.tsx`, `index.html`
  - `src/cli/init.ts`
  - The `package.json` export map
- **Tooling:**
  - `tsup.config.ts` → `tsdown.config.ts`
  - The ESLint config is removed; `.oxlintrc.json` is added.
  - `tsconfig` files for TS 7 (drop `ignoreDeprecations`, make `types` explicit)
  - `.npmrc` and `pnpm-workspace.yaml`
  - The root `packageManager` field
  - The lefthook and commitlint setup is unchanged.
- **CI:**
  - All five workflows: pnpm setup and the Node matrix (drop 20.x below 20.19; the CLI needs ≥22.22.3)
  - New perf-gate job
- **Example and fixtures:**
  - `examples/minimal` on Nest 12, with Vitest replacing Jest
  - `test/integration` and `test/e2e` fixture generators (`nest new`) on the Nest 12 CLI
- **Dependencies:**
  - Removed: tsup, eslint, typescript-eslint
  - Added: tsdown, oxlint, oxlint-tsgolint, `@typescript/typescript6` (alias, only if still required after migration), and a prompt library for the CLI
  - The Nest 11 overrides (multer, the platform-fastify pin) are re-evaluated.
- **Docs:** New getting-started guide for Nest 12, a migration guide, a performance page, a refreshed landing page, and a VitePress upgrade evaluation.
- **Users:** No action required. Nest 11 apps keep working; Nest 12 apps are now supported. The new route splitting and dev hot update are opted into by regenerating or editing `vite.config` and `entry-client.tsx`.
- **Supersedes:** Snyk PR #138.
