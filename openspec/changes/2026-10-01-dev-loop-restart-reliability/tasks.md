## 1. Reproduce with timing instrumentation

- [ ] 1.1 Add temporary (or permanently debug-gated) timestamps around:
      the file write in `edit()`, the `fs.watch` callback firing in
      `src/cli/dev.ts:214`'s `onOutputChanged`, and the point `dev.ts`
      decides "view update" vs. "restart". Capture the delta.
- [ ] 1.2 Run `EXAMPLE_MODE=dev pnpm test:example -- dev-loop` at least 20
      times back to back (loop in a shell, not Playwright's own repeat, so
      each run is a fresh `nestjs-ssr dev` process) and record the
      write-to-detection latency distribution for both the view-edit and
      service-edit paths
- [ ] 1.3 Run the same loop under artificial load (e.g. a concurrent
      `pnpm test` or `find / ...` in the background) to see whether latency
      scales with system load, matching the aggravating-factor theory from
      the 2026-09-29 verification notes
- [ ] 1.4 Record the p50/p95/max latency and whether any run drops/coalesces
      an event entirely (detection never fires within a generous ceiling,
      e.g. 10 s)

## 2. Decide the fix

- [ ] 2.1 If latency is bounded and just exceeds the current budgets under
      load: widen `UPDATE_BUDGET_MS` and/or wrap the `serverHtml('/recipes')`
      check on `dev-loop.spec.ts:116` in the file's existing `waitFor`
      helper instead of a single unretried fetch — pick the margin from
      1.4's measured p95/p99, not a guess
- [ ] 2.2 If events are dropped/coalesced outright (not just slow): replace
      `dev.ts:214`'s raw recursive `fs.watch(outDir, { recursive: true })`
      with a mechanism that doesn't lose events under the same load profile
      (e.g. per-directory watches instead of one recursive watch, a
      polling fallback, or a maintained watch library already used
      elsewhere in the workspace if one fits without a new dependency)
- [ ] 2.3 These aren't exclusive — document in this file which combination
      1.4's data supports before implementing either

## 3. Implement

- [ ] 3.1 Apply the chosen test-side hardening, the chosen `dev.ts` change,
      or both, per task 2's decision
- [ ] 3.2 Remove or gate behind a debug flag the timing instrumentation
      added in task 1, unless task 2 concluded it's worth keeping
      permanently (e.g. as a `--verbose` dev-server log line)

## 4. Verify

- [ ] 4.1 Run `EXAMPLE_MODE=dev pnpm test:example -- dev-loop` for N
      consecutive clean passes (N = 20, matching task 1's sample size) with
      no retries or re-runs of a failed pass
- [ ] 4.2 Repeat once under the same artificial load used in 1.3, to confirm
      the fix holds under the condition that most plausibly caused the
      original flake
- [ ] 4.3 Confirm `EXAMPLE_MODE=prod pnpm test:example` and the integration
      suites are unaffected
