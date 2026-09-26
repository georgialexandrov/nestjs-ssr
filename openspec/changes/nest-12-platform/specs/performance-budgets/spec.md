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

### Requirement: SSR throughput budget

The SSR-to-JSON throughput ratio for `/recipes` on the same machine SHALL be at least 0.80. The 0.3.31 baseline is 0.47. The pipeline micro-benchmark's HTML median SHALL NOT exceed its recorded baseline multiplied by the configured tolerance.

#### Scenario: CI throughput gate

- **WHEN** the performance job runs in CI
- **THEN** it SHALL fail if the measured SSR-to-JSON ratio for `/recipes` is below 0.80

#### Scenario: Micro-benchmark regression

- **WHEN** `pnpm bench` measures an HTML median above baseline × tolerance
- **THEN** the command SHALL exit non-zero and name the regressed measurement

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

- **WHEN** the Playwright hydration measurement exceeds baseline × 1.10 for the median of five runs
- **THEN** the browser performance test SHALL fail
