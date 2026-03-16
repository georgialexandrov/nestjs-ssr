## ADDED Requirements

### Requirement: Module-level jsonApi config

The `RenderModule.forRoot()` and `RenderModule.forRootAsync()` SHALL accept a `jsonApi` boolean option.

#### Scenario: Enable globally via forRoot

- **WHEN** the module is configured with `RenderModule.forRoot({ jsonApi: true })`
- **THEN** all `@Render()` routes SHALL accept JSON API requests by default

#### Scenario: Default is disabled

- **WHEN** the module is configured without the `jsonApi` option
- **THEN** JSON API mode SHALL be disabled (equivalent to `jsonApi: false`)

#### Scenario: Enable globally via forRootAsync

- **WHEN** the module is configured with `RenderModule.forRootAsync({ useFactory: () => ({ jsonApi: true }) })`
- **THEN** all `@Render()` routes SHALL accept JSON API requests by default

### Requirement: Per-route jsonApi override

The `@Render()` decorator's options SHALL accept a `jsonApi` boolean that overrides the module-level setting.

#### Scenario: Disable on specific route

- **WHEN** the module has `jsonApi: true`
- **AND** a route has `@Render(Component, { jsonApi: false })`
- **THEN** that route SHALL NOT serve JSON API responses
- **AND** SHALL return 406 for JSON requests

#### Scenario: Enable on specific route

- **WHEN** the module has `jsonApi: false` (or unset)
- **AND** a route has `@Render(Component, { jsonApi: true })`
- **THEN** that route SHALL serve JSON API responses

#### Scenario: No override uses module default

- **WHEN** a route has `@Render(Component)` with no `jsonApi` option
- **THEN** the module-level `jsonApi` setting SHALL apply

### Requirement: Config resolution order

The system SHALL resolve JSON API enablement as: route-level → module-level → false.

#### Scenario: Resolution precedence

- **WHEN** determining if JSON API is enabled for a route
- **THEN** the system SHALL check `@Render` options `jsonApi` first
- **AND** if undefined, check module config `jsonApi`
- **AND** if undefined, default to `false`
