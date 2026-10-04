## ADDED Requirements

### Requirement: Recorded performance baselines

The repository SHALL contain committed harnesses and recorded baselines for:

- pipeline overhead (micro-benchmark);
- end-to-end SSR HTTP throughput;
- client bundle size per chunk;
- client hydration start time;
- development view edit-to-update latency.

Each baseline SHALL record the Node version, the machine description and the date.

#### Scenario: Running the end-to-end harness locally

- **WHEN** a developer runs the end-to-end throughput harness
- **THEN** it SHALL build the example in production mode and measure SSR `/`, SSR `/recipes` and JSON `/recipes`
- **AND** it SHALL print requests per second, p50 and p99 latency for each, and the SSR-to-JSON throughput ratio

### Requirement: SSR cost budget

The gate is server CPU per request, measured inside the NestJS process: JSON `/recipes` CPU divided by SSR `/recipes` CPU, which cancels machine speed. It SHALL be at least the `minimumCpuRatio` recorded in `test/perf/baseline.json` (0.40; measured 0.46 on 2026-09-27). The original 0.80 throughput target is withdrawn (see design, "Measured reality"): shared costs such as the payload snapshot fell for JSON as well, and React rendering plus encoding the larger HTML body are inherent to SSR.

The pipeline micro-benchmark's HTML p95 SHALL NOT exceed its recorded baseline multiplied by the configured tolerance on the machine that recorded the baseline. Response sizes and listener leaks SHALL be enforced on every machine.

#### Scenario: CI cost gate

- **WHEN** the performance job runs in CI
- **THEN** it SHALL fail if the JSON/SSR CPU ratio for `/recipes` is below the recorded minimum

#### Scenario: Micro-benchmark regression

- **WHEN** `pnpm bench` measures an HTML p95 above baseline × tolerance on the recording machine
- **THEN** the command SHALL exit non-zero and name the regressed measurement

#### Scenario: Micro-benchmark on another machine

- **WHEN** `pnpm bench` runs on a machine other than the one that recorded the baseline
- **THEN** it SHALL report times without gating on them, and SHALL still fail on grown response sizes or leaked listeners

### Requirement: Client bundle budget

Each client chunk of the example application SHALL have a size-limit budget. The chunks are the entry, vendor and each route chunk. Initial JavaScript for a single-route visit SHALL consist of the runtime, vendor, entry and that route's chunk only.

#### Scenario: A view grows past its budget

- **WHEN** a route chunk exceeds its configured size limit
- **THEN** the size check SHALL fail and report the chunk and its size

#### Scenario: Initial load of one route

- **WHEN** the browser loads `/recipes` in the production example
- **THEN** no JavaScript chunk belonging only to another route SHALL be requested before the page is interactive

### Requirement: Hydration timing budget

The time from navigation start to hydration start on the production example SHALL NOT exceed the recorded baseline by more than 10%.

#### Scenario: Hydration regression

- **WHEN** the Playwright hydration measurement exceeds baseline × 1.10 for the median of five runs, on the machine that recorded the baseline
- **THEN** the browser performance test SHALL fail
