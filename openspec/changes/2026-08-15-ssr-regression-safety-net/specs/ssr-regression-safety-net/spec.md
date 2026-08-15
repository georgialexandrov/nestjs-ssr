## ADDED Requirements

### Requirement: Browser test suites execute in CI

The CI pipeline SHALL run the Playwright integration and e2e suites on every pull request, in both development and production modes, and SHALL fail the build when any of them fail.

#### Scenario: Integration suites run in both modes

- **WHEN** a pull request is opened against `main`
- **THEN** CI SHALL run `test:integration:dev` and `test:integration:prod`
- **AND** a failure in either SHALL fail the build

#### Scenario: E2E suites run

- **WHEN** a pull request is opened against `main`
- **THEN** CI SHALL run the e2e suite covering hydration, layouts, navigation, SEO, and adapter equivalence

#### Scenario: CI edit does not conflict with dependency bumps

- **WHEN** the browser job is added to `.github/workflows/ci.yml`
- **THEN** the change SHALL be append-only, adding a new job without modifying existing jobs or step versions

#### Scenario: Fixture creation is cached

- **WHEN** the browser job runs and the fixture setup scripts and lockfile are unchanged since the previous run
- **THEN** the job SHALL reuse cached fixtures rather than re-running `nest new`

### Requirement: Layout composition has exactly one implementation

Server-side and client-side layout composition SHALL be performed by a single shared function exported from the package. Neither entry template nor any test SHALL define its own copy.

#### Scenario: Both entry templates import the shared function

- **WHEN** `entry-server.tsx` and `entry-client.tsx` compose a component with layouts
- **THEN** both SHALL call the same exported `composeWithLayouts`
- **AND** neither file SHALL contain a local definition of the algorithm

#### Scenario: The spec tests the shipped function

- **WHEN** `compose-layouts.spec.tsx` runs
- **THEN** it SHALL import `composeWithLayouts` from the package
- **AND** it SHALL NOT define a local copy of the algorithm

#### Scenario: Templates remain copyable into user projects

- **WHEN** `npx @nestjs-ssr/react init` scaffolds a user project
- **THEN** the copied entry templates SHALL resolve the shared function through a public package export

### Requirement: Server output and client hydration produce identical DOM

A parity test SHALL render each supported layout configuration through the real server path, hydrate it through the real client path, and fail on any hydration mismatch.

#### Scenario: Hydration mismatch fails the test

- **WHEN** hydration of server-rendered HTML produces a React hydration-mismatch `console.error`
- **THEN** the test SHALL fail

#### Scenario: Silent structural drift fails the test

- **WHEN** the DOM after hydration differs from the server-rendered HTML
- **THEN** the test SHALL fail, even if React reported no error

#### Scenario: Root layout only

- **WHEN** a page is rendered with only an auto-discovered root layout
- **THEN** server and client output SHALL match

#### Scenario: Controller-level layout on hard refresh

- **WHEN** a page is rendered with a root layout plus a controller-level `@Layout()`, and the client rebuilds the chain from `window.__LAYOUTS__`
- **THEN** server and client output SHALL match

#### Scenario: Nested layout chain

- **WHEN** a page is rendered with three nested layouts
- **THEN** server and client output SHALL match, with layouts nested outermost-first

#### Scenario: Layout opt-outs

- **WHEN** a page is rendered with `layout: false` or `layout: null`
- **THEN** server and client output SHALL match

#### Scenario: Component carrying a static layout property

- **WHEN** a view component exposes a static `.layout` property and no `__LAYOUTS__` data is present
- **THEN** server and client output SHALL match

#### Scenario: Component using page context hooks

- **WHEN** a view component calls `usePageContext()`
- **THEN** server and client output SHALL match, both being wrapped in `PageContextProvider`

#### Scenario: Provider wrappers stay DOM-free

- **WHEN** the client wraps output in `NavigationProvider` and the server does not
- **THEN** the parity test SHALL fail if either provider ever emits DOM

### Requirement: Component resolution works under production minification

Component and layout name resolution SHALL be verified against production-shaped inputs in which function names have been mangled by the bundler.

#### Scenario: Minified default export with kebab-case filename

- **WHEN** a view file `login-page.tsx` has a default export whose `name` is minified to `t`, and the server sends `LoginPage`
- **THEN** resolution SHALL match the component via its normalized PascalCase filename

#### Scenario: Minified layout resolution

- **WHEN** a layout file `admin-layout.tsx` has a minified export and the server sends `AdminLayout` in `__LAYOUTS__`
- **THEN** resolution SHALL match the layout

#### Scenario: Production mode exercised in a real build

- **WHEN** the production-mode browser suite runs
- **THEN** it SHALL exercise a real minified Vite build, not a simulation

### Requirement: The dev server survives repeated hot-reload restarts

A restart-loop test SHALL drive a real `nest start --watch` cycle with a browser attached and verify that every restart completes cleanly.

#### Scenario: Repeated restarts release the port

- **WHEN** a source file is modified N times under `nest start --watch`
- **THEN** each respawned process SHALL serve on port 3000 within the timeout
- **AND** no run SHALL report `EADDRINUSE`

#### Scenario: An upgraded WebSocket does not block shutdown

- **WHEN** a browser holds an upgraded HMR WebSocket through the Nest proxy and the process receives SIGTERM
- **THEN** the process SHALL exit within the timeout

#### Scenario: The browser is required

- **WHEN** the restart-loop test runs
- **THEN** it SHALL attach a real browser, so that upgraded-socket regressions are reachable

#### Scenario: Scheduled rather than per-PR

- **WHEN** the restart-loop test is scheduled
- **THEN** it SHALL run nightly and on pull requests that modify the `vite` dependency, and SHALL NOT gate every pull request

### Requirement: Dependency updates to Vite run the full safety net

Pull requests that change the `vite` dependency SHALL run the browser suites and the restart-loop test.

#### Scenario: Vite bump triggers extended checks

- **WHEN** a pull request modifies the `vite` version in any manifest or the lockfile
- **THEN** CI SHALL run the browser suites and the restart-loop test before the PR is mergeable

### Requirement: Template sources are measured by coverage

The coverage configuration SHALL NOT exclude `src/templates/**`.

#### Scenario: Templates report coverage

- **WHEN** `pnpm test:coverage` runs
- **THEN** `src/templates/**` SHALL appear in the coverage report

#### Scenario: Thresholds reflect the new baseline

- **WHEN** template coverage is included
- **THEN** coverage thresholds SHALL be re-baselined to the achieved level or higher, never lowered below the pre-change values
