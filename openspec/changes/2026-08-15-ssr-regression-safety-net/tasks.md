## 1. Run the browser suites in CI

- [ ] 1.1 Append a `browser` job to `.github/workflows/ci.yml` — new job at end of file, no edits to existing jobs or step versions (avoids conflict with in-flight `actions/*` bumps)
- [ ] 1.2 Install Playwright browsers with `--with-deps chromium`
- [ ] 1.3 Run `test:integration:setup`, then `test:integration:dev` and `test:integration:prod`
- [ ] 1.4 Run `test:e2e:setup`, then `test:e2e:dev` and `test:e2e:prod`
- [ ] 1.5 Cache `test/integration/fixtures` and `test/e2e/fixtures` keyed on the setup scripts + `pnpm-lock.yaml` (fixture creation shells out to `nest new`)
- [ ] 1.6 Upload the Playwright report as an artifact on failure
- [ ] 1.7 Fix `test/integration/global-setup.ts`: both the prod and dev branches catch a fixture start failure, log it, and then unconditionally print `✅ All servers started!`. Verified locally — both fixtures failed to boot and the setup still reported success, turning one infrastructure fault into 40 confusing product-test failures. Re-throw (or track failures and exit non-zero) so the job fails at setup with the real cause.
- [ ] 1.8 Fix the 6 failing integration tests before the job becomes required (see "Baseline measured" below)
- [ ] 1.9 Mark the job required in branch protection

### Baseline measured 2026-08-15

Fixtures regenerated from `main`'s init script (24s), then `TEST_MODE=dev` integration run:
**34 passed, 6 failed.** The same three tests fail in both the `string` and `stream` fixtures:

- `hydration.spec.ts:33` — hydration enables button clicks
- `layouts.spec.ts:274` — interactive elements work after hydration with controller layout
- `layouts.spec.ts:289` — interactive elements work after hard refresh

All three are interactivity-after-hydration: SSR markup renders correctly, `count` stays
at `0` forever. Root cause captured from the browser:

```
TypeError: require_react is not a function
  at /node_modules/.vite/deps/react_jsx-dev-runtime.js:179
  at /node_modules/.vite/deps/rolldown-runtime-BvCyGRYZ.js:2
```

The error is thrown inside Vite's own optimized-dependency output, so `entry-client.tsx`
dies before `hydrateRoot` and the page is inert. Notably `no hydration mismatch warnings`
still **passes** — nothing hydrates, so nothing can mismatch. A green mismatch test next to
a dead page is precisely the failure mode the parity test in section 3 is designed to close.

Ruled out: asset proxying (`/src/views/entry-client.tsx`, `/@vite/client` all 200 through
Nest), and `resolve.dedupe` (adding the example's dedupe to the fixture config changed
nothing).

Still open: the fixture installs `vite@7.3.6` and `@vitejs/plugin-react@^4.7.0` while the
workspace develops against vite 8.2.1 / plugin-react 6. Determine whether this is a vite 7
dep-optimizer interop bug — in which case the `^8 || ^7 || ^6` peer range advertises vite 7
support that does not work — or whether the init scaffold needs `optimizeDeps` settings the
maintained example config carries. `examples/minimal` was also observed not executing
`entry-client.tsx` (`window.__MODULES__` unset, navigation full-reloads), but that tree had
uncommitted local edits at the time, so it is not evidence about `main`.

- [ ] 1.10 Root-cause `require_react is not a function`: bisect vite 7.3.6 vs 8.2.1 in a fixture, and confirm whether `examples/minimal` hydrates on a clean checkout of `main`
- [ ] 1.11 Depending on 1.10, either narrow the `vite` peer range or fix the init-scaffolded `vite.config.ts`

Note: stale fixtures are a real hazard. Locally the checked-out fixtures still
pointed at `vite@7.3.6` in the pnpm store, which no longer exists after the vite 8
bump, so every fixture failed to boot. The cache key in 1.5 includes `pnpm-lock.yaml`
precisely so a Vite bump invalidates fixtures rather than resurrecting broken ones.

## 2. Single composition implementation

- [ ] 2.1 Create `src/react/compose/compose-layouts.tsx` with `composeWithLayouts(ViewComponent, props, layouts, context)` — reverse iteration, `data-layout`/`data-outlet` wrappers, `displayName || name || 'Layout'` naming
- [ ] 2.2 Export it from `@nestjs-ssr/react/client` (both templates already import from there)
- [ ] 2.3 Rewrite `src/templates/entry-server.tsx` to import it; delete the local `composeWithLayouts`
- [ ] 2.4 Rewrite `src/templates/entry-client.tsx` to import it; delete the local `composeWithLayout`, keeping the static-`.layout`-chain walk as a separate step that builds the `layouts` array before calling the shared function
- [ ] 2.5 Delete the local algorithm copy in `src/__tests__/unit/compose-layouts.spec.tsx` and import the real export; keep every existing assertion
- [ ] 2.6 Apply the same change to `examples/minimal/src/views/entry-*.tsx`
- [ ] 2.7 Verify the size-limit budget (30 KB) still holds

## 3. SSR ↔ hydration parity test

- [ ] 3.1 Add `src/__tests__/integration/hydration-parity.spec.tsx` with a helper that renders via the server path, injects the HTML into `#root`, sets `__COMPONENT_NAME__` / `__INITIAL_STATE__` / `__CONTEXT__` / `__LAYOUTS__` / `__MODULES__`, hydrates via the client path, and flushes effects
- [ ] 3.2 Fail the test on any `console.error` matching a hydration-mismatch signature
- [ ] 3.3 Also assert post-hydration `innerHTML` equals the server-rendered string
- [ ] 3.4 Add cases: no layout; root only; root + controller; root + controller + method; 3-deep nested; `layout: false`; `layout: null`; static `.layout` property; kebab-case filename; component calling `usePageContext()`
- [ ] 3.5 Assert `NavigationProvider` and `PageContextProvider` emit no DOM, pinning the current server/client wrapper asymmetry as benign
- [ ] 3.6 Confirm props are passed spread (not wrapped in `data`) per the current `PageProps` contract
- [ ] 3.7 Verify each case fails when run against the pre-fix implementation of its corresponding bug (`71d1bc4`, `d283a48`, `3e5a3bf`, `b9bd070`) — a case that cannot fail is not a regression test

## 4. Minification-shape resolution tests

- [ ] 4.1 Extend `src/react/navigation/__tests__/resolve-component.spec.ts` with production-shaped modules: default export named `t`, file `login-page.tsx`, server-sent name `LoginPage`
- [ ] 4.2 Add the layout equivalent: `admin-layout.tsx` minified, server sends `AdminLayout`
- [ ] 4.3 Confirm these fail against the pre-`b956ea2` normalization

## 5. Hot-reload restart loop

- [ ] 5.1 Add `test/hot-reload/restart-loop.ts` that boots the minimal fixture under `nest start --watch`
- [ ] 5.2 Attach a real Chromium page and wait for the HMR WebSocket to establish — required, since `c2db432` was about upgraded sockets and the failure is unreachable without one
- [ ] 5.3 Loop N times (default 8): touch a source file, wait for respawn, assert `:3000` responds within the timeout
- [ ] 5.4 Fail on any `EADDRINUSE` in captured output, and on any restart exceeding the timeout
- [ ] 5.5 Also assert the SIGTERM-during-startup path (`ebec8a9`): send SIGTERM at randomized 50–700 ms offsets into startup and assert the process still exits
- [ ] 5.6 Add a nightly workflow running it; do not add it to the per-PR required set
- [ ] 5.7 Verify it fails against `1438f59` (pre-`c2db432`) with a browser attached

## 6. Gate Vite bumps

- [ ] 6.1 Add a path/content filter so PRs changing the `vite` version run the browser job and the restart-loop job
- [ ] 6.2 Document in `CONTRIBUTING` (or `docs/development.md`) that Vite bumps require both

## 7. Un-hide the templates

- [ ] 7.1 Remove the `src/templates/**` exclusion from `vitest.config.ts` coverage config
- [ ] 7.2 Re-baseline thresholds to the achieved level; never below the current 70/63/55/70
- [ ] 7.3 Drop the stale `TODO: Increase as we add more tests` comment

## 8. PR #113 follow-ups — RELEASE BLOCKERS

PR #113 (`nest-cli.json` SSR path resolution) is being merged before these land. They must
be done before the next published release, not before the merge. Do not cut a release with
any of 8.1–8.3 open.

- [ ] 8.1 Add `@vitejs/plugin-react` to `peerDependencies` — PR #113 added a runtime `await import('@vitejs/plugin-react')` in `vite-initializer.service.ts`, but the package declares it only as a devDependency. Consumers who set up by hand or pruned dev deps get module-not-found at boot.
- [ ] 8.2 Stop the embedded Vite server discarding user config. PR #113 sets `configFile: false` and hardcodes `plugins: [react({})]`, the `@` alias, `dedupe`, and `ssr.noExternal`. The client-side Vite still reads `vite.config.ts`, so user plugins (Tailwind, svgr, MDX, CSS-in-JS Babel plugins), extra aliases, and `define`/`envPrefix` apply on the client and are silently dropped on the server — the same server/client divergence class as the five hydration bugs. Merge the defaults over the resolved user config (`mergeConfig`) rather than replacing it. **Ask the contributor first** why config resolution was bypassed; there may be a monorepo ordering problem being routed around.
- [ ] 8.3 Wrap the `JSON.parse` in `readNestCliConfig` and rethrow with the file path — `forRoot()` evaluates the resolver eagerly via `useValue`, so a malformed `nest-cli.json` currently throws a bare `SyntaxError` at module import.
- [ ] 8.4 Document the new `project` and `viewsDir` options with a monorepo setup section
- [ ] 8.5 Re-run the browser suites from section 1 against the merged result, since #113 moves production path resolution

## 9. Verify

- [ ] 8.1 `pnpm test` in `packages/react`
- [ ] 8.2 `pnpm typecheck`
- [ ] 8.3 `pnpm lint` — no new warnings above the 111 baseline on `main`
- [ ] 8.4 `pnpm build:package`
- [ ] 8.5 `pnpm dev:minimal` — manual confirmation that HMR and hydration still work end to end
