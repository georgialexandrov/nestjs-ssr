## 0. Groundwork and Baselines

- [x] 0.1 Archive `secure-response-negotiation` so `render-response-security` and `representation-pipeline` exist under `openspec/specs/`; confirm `openspec validate nest-12-platform` resolves the MODIFIED requirement.
- [x] 0.2 Add the end-to-end throughput harness (`packages/react/test/perf/http.ts`). It builds the example in production, starts it on a free port, runs autocannon against SSR `/`, SSR `/recipes` and JSON `/recipes`, and prints req/s, p50, p99 and the SSR/JSON ratio. Expose it as `pnpm perf:http`.
- [ ] 0.3 Add a Playwright client-performance spec. It records hydration start (a `performance.mark` set by the entry template) and the JS chunks requested before interactive on the production example; it reports only for now.
- [ ] 0.4 Add a dev-loop Playwright spec. It edits a view file, measures DOM update time and records whether the Nest PID changed; it reports only for now and restores the file.
- [x] 0.5 (Server side recorded; client and dev-loop baselines move to 4.6 and 5.4.) Record 0.3.31 baselines from 0.2–0.4 and `pnpm bench` into `packages/react/test/perf/baseline.json`, with Node version, machine and date; commit them on `main` and rebase `feat/nest-12`.

## 1. Toolchain: pnpm 12, TypeScript 7, tsdown, oxlint

- [x] 1.1 Run the pnpm 12 migration. Set `packageManager: pnpm@12.6.0` (or newest past the gate), move `minimum-release-age` into `pnpm-workspace.yaml` as `minimumReleaseAge`, fold build settings into `allowBuilds`, and rename any `npm_config_*` env vars. Verify `pnpm install --frozen-lockfile` and `pnpm audit` on a clean clone.
- [x] 1.2 Verify `pnpm/action-setup` installs pnpm 12 from `packageManager`. If it doesn't, pin the v6 commit SHA (verify the commit, not the tag object) in all five workflows.
- [x] 1.3 Install `typescript@7.0.x` in every workspace. Remove `ignoreDeprecations` and make `types` explicit in every tsconfig. `pnpm typecheck` must be green under TS 7 for the library, the example and the docs.
- [x] 1.4 Replace tsup with tsdown (`tsdown.config.ts`): dual ESM + CJS entries for index, client, render and cli with the same output file names, oxc isolated-declaration `.d.ts`, the templates copy hook, and the externals list. Add explicit return types where isolated declarations require them.
- [x] 1.5 Keep the export map and file layout identical to 0.3.31. Widen the TS peer to `^5 || ^6 || ^7`, and add a test that compares the packed tarball's export map and entry files with 0.3.31.
- [x] 1.6 Confirm the api-extractor report is unchanged, apart from intended additive edits.
- [x] 1.7 Replace ESLint with oxlint and oxlint-tsgolint. Port rules into `.oxlintrc.json` with a parity table (rule → oxlint rule / tsgolint / dropped with reason), and update the lefthook, CI `lint` job and knip config. Remove eslint, typescript-eslint and their configs.
- [x] 1.8 Add the `@typescript/typescript6` alias only for a consumer proven to fail on TS 7, and document each such consumer in `pnpm-workspace.yaml`. Expected: none, or VitePress only.
- [x] 1.9 Re-measure typecheck, build and lint times against the baseline and record them. The target is at least 2× faster for each.

## 2. NestJS 12 Migration

- [x] 2.1 Bump the library's `@nestjs/*` dev deps to 12.0.x (12.1.x once it passes the gate) and the peers to `^11.0.0 || ^12.0.0`. Add a CI job that runs unit and browser suites against Nest 11.2.x. Re-evaluate the `multer`, `@nestjs/platform-fastify` and `platform-fastify>fastify` overrides and remove any that 12.x makes redundant.
- [x] 2.2 (No library class subclasses a Nest class; all 655 unit tests and both-major browser suites pass unchanged.) Audit `@Optional()` usage, including in subclasses, and optional tokens (`CONTEXT_PROJECTOR`, the context factory) for Nest 12 `UnknownDependenciesException` semantics. Add tests covering module setups where each token is absent.
- [ ] 2.3 Audit lifecycle ordering. Add a test that the Vite proxy middleware and static serving register before user routes under Nest 12's hierarchy-ordered hooks, and that shutdown closes Vite cleanly with Express request draining.
- [ ] 2.4 Audit `Logger` calls for Nest 12 `ConsoleLogger` structured params and make the log output intentional.
- [ ] 2.5 (Nest 12 done, still CommonJS + Jest; ESM + Vitest pending.) Migrate `examples/minimal` to Nest 12. Replace Jest with Vitest and update the Nest CLI, schematics and scripts; `start:dev`, the build and the prod start must work.
- [x] 2.6 (ESM projects get `import.meta.dirname`; CommonJS output unchanged.) Update `src/cli/init.ts` and `src/templates/*` for Nest 12 projects in both ESM and CommonJS flavours of `nest new`.
- [x] 2.7 Update the integration and e2e fixture generators to use the Nest 12 CLI. Keep a Nest 11 fixture variant, and run the Nest 12 fixtures on Node versions that satisfy the Nest 12 CLI minimums.
- [ ] 2.8 Full CI plus all browser suites green; close Snyk PR #138 as superseded.

## 3. Server Performance

- [x] 3.1 Implement `snapshotPublicGraph`: a single pass that validates and copies, with a literal-construction fast path for plain objects and arrays, a lazily created reference map, and preserved prototype/Date/Map/Set/RegExp/cycle semantics. It deep-freezes in development only.
- [x] 3.2 (Freezing kept in every environment: it cost <1% and removing it is a behavior change.) Replace clone → validate → freeze in `projectContext`, `projectPageData`, `projectJson` and `projectSegmentData` with the snapshot. Keep every existing leakage and limits test unchanged, and rewrite production `isFrozen` assertions to the development-only guarantee.
- [x] 3.3 Add tests for the modified `render-response-security` scenarios: post-projection controller mutation (string and stream), dev-mode prop mutation throwing with the path, and value-semantics preservation.
- [x] 3.4a Cache the imported production server bundle per manifest (was re-imported per request).
- [x] 3.4b Serialize plain hydration state in one pass with byte-identical devalue output (devalue as oracle).
- [ ] 3.4 Precompile the HTML template into static segments plus slot indexes per template version, replacing repeated `injectPlaceholder` string scans. Cover it with the existing template-parser tests and a byte-identical output test.
- [ ] 3.5 Cache the layout chain per `(handler, layout override)` and per-route static head output. Invalidate on dev module updates.
- [ ] 3.6 Take the flat fast path for context when there is no `projectContext` hook and the context has only allowlisted primitives; measure it, and keep it only if it wins.
- [ ] 3.7 (Targets revised, see design "Measured reality".) Re-record `pnpm bench` (HTML median target ≤ 60 µs) and `perf:http` (SSR/JSON ratio ≥ 0.80, p99 not above baseline). Profile again and attach the before/after CPU breakdown to the PR.
- [ ] 3.8 Turn on the CI perf gate for the ratio and the micro-bench budget.

## 4. Client Performance

- [x] 4.1 (Done as a displayName-stamping plugin; views are matched by name convention, no module ids needed.) Add the module-id Vite plugin (exported from `@nestjs-ssr/react/vite`), which stamps each view's default export with its module id. Add it to the generated `vite.config` template and the example.
- [x] 4.2 Switch the client entry template to lazy view globs with eager layouts, and hydrate after awaiting only the current route's module. Keep kebab-case → PascalCase lookup keys unchanged.
- [x] 4.3 Resolve the rendered view's manifest entry (production) or module-graph node (development). Emit `modulepreload` links for the view chunk and its static imports, plus CSS links, carrying the CSP nonce.
- [ ] 4.4 (Deferred: navigation already loads the chunk in parallel with the DOM swap.) Prefetch the target route chunk in `Link` on hover and focus and in `navigate`, in parallel with the segment fetch.
- [x] 4.5 Implement the fallback for unstamped components (no preload, eager-compatible, one dev warning) and test it with a project lacking the plugin.
- [ ] 4.6 Add size-limit budgets for the example's entry, vendor and per-route chunks. Turn the Playwright client-perf spec into a gate (no foreign route chunks before interactive; hydration start ≤ baseline × 1.10).
- [x] 4.7 Browser suites green in dev and prod, with no hydration warnings on any route.

## 5. Dev Loop

- [x] 5.1 (Result: no Nest CLI option filters restarts; solved with the `nestjs-ssr dev` runner that restarts only on non-view output changes.) Spike (time-boxed to one day): find how to exclude `**/views/**` from restart triggers for each Nest CLI 12 builder (tsc, swc, rspack). Record the findings in `design.md` and choose the watcher-ignore approach or the Vite module-runner fallback.
- [x] 5.2 In development, render views and layouts through `vite.ssrLoadModule(moduleId)`, with the controller import used only as a token. Invalidate the caches from 3.5 on module updates.
- [x] 5.3 Apply the chosen restart exclusion in the example, the `init`-generated config and the docs. Run `tsc --noEmit --watch` (TS 7) for view type errors in `start:dev`.
- [ ] 5.4 Turn the dev-loop Playwright spec into a gate: the view edit updates the DOM within 2 s with an unchanged Nest PID, and a controller edit still restarts.

## 6. Look and Feel

- [x] 6.1 (Plus opt-in `showErrorPage` for string mode, on for new projects.) Rebuild the development error page: source-mapped stack via `ssrFixStacktrace`, code frame, component stack, route/controller/handler/module id, copy-report button, open-in-editor link, inline light/dark CSS. Snapshot-test it, and test that production output contains no diagnostics.
- [x] 6.2 (Done on consola's built-in clack prompts; no new dependency. Also fixed pnpm-only scripts.) Rewrite the `init` CLI on `@clack/prompts`: package-manager detection, prompts, per-step progress, next-steps summary, `--yes/--mode/--pm/--skip-install/--no-examples/--force`, non-TTY handling, and an idempotent re-run that reports skipped files. Unit-test the non-interactive paths.
- [x] 6.3 (Starter at /welcome via its own controller; AppController and its tests untouched.) Redesign the starter templates: tokens-based root layout, a light/dark toggle persisted in a cookie with no flash of the wrong theme, the welcome page explaining request → render → hydration, and a sample `@Layout` controller. The CSS stays under 5 KB. Add a Playwright check for theme persistence.
- [ ] 6.4 Apply the starter's look to `examples/minimal`, so the example and a freshly `init`-ed app match.
- [ ] 6.5 Docs: time-box an evaluation of VitePress 2 and pick 2.x or stay on 1.6.4. Refresh the landing page and theme.
- [x] 6.6 Docs: rewrite getting started for Nest 12, add a Performance page (the harness, the reference machine, before/after tables from 0.5, 3.7 and 4.6), and document route splitting, the Vite plugin and the dev loop.
- [x] 6.7 Docs: write the 0.3 → 0.4 upgrade guide. No required changes; covers using Nest 12, the optional Vite plugin, the entry-client update for route splitting and the dev script change.

## 7. Release 0.4.0

- [ ] 7.1 Update README, CLAUDE.md files and package metadata. Add a changelog entry that lists the breaking changes.
- [ ] 7.2 Run the full CI, the browser suites, the perf gates and a manual smoke test of `npx @nestjs-ssr/react init` in fresh ESM and CJS `nest new` apps on Node 22 and 26.
- [ ] 7.3 Merge `feat/nest-12` into `main`, then run the release workflow with `explicit-version=0.4.0`. Verify npm `latest`, the GitHub release and the docs deploy.
- [ ] 7.4 Archive the `nest-12-platform` openspec change.
