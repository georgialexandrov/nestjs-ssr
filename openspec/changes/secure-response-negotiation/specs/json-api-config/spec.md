## MODIFIED Requirements

### Requirement: Module-level jsonApi config

The render module SHALL accept a module-level representation policy alongside the supported `jsonApi` configuration.

#### Scenario: Enable JSON through representation policy

- **WHEN** the module representation policy enables JSON
- **THEN** rendered routes SHALL offer JSON by default unless overridden

#### Scenario: Default is HTML only

- **WHEN** neither representation policy nor `jsonApi` is configured
- **THEN** rendered routes SHALL offer HTML and SHALL NOT implicitly expose page props as JSON

#### Scenario: Global JSON flag

- **WHEN** the module is configured with `jsonApi: true`
- **THEN** the result adapter SHALL enable the established props-as-JSON behavior
- **AND** SHALL NOT emit a deprecation or migration warning

#### Scenario: Async module policy

- **WHEN** an async module factory returns a representation policy
- **THEN** the system SHALL apply it identically to synchronous module configuration

### Requirement: Per-route jsonApi override

The render decorator SHALL accept route-level representation policy that overrides module policy and SHALL retain `jsonApi` as a supported route option.

#### Scenario: Disable JSON on specific route

- **WHEN** module policy enables JSON
- **AND** route representation policy disables JSON
- **THEN** that route SHALL NOT offer a JSON representation

#### Scenario: Enable JSON on specific route

- **WHEN** module policy disables JSON
- **AND** route representation policy enables JSON
- **THEN** that route SHALL offer its explicit JSON representation

#### Scenario: No route override uses module default

- **WHEN** a route has no representation or `jsonApi` override
- **THEN** the module representation policy SHALL apply

### Requirement: Config resolution order

The system SHALL resolve representation availability in the order explicit controller result, route representation policy, module representation policy, route `jsonApi`, module `jsonApi`, then secure HTML-only default.

#### Scenario: Explicit result and jsonApi conflict

- **WHEN** a controller returns an explicit representation result and `jsonApi` is also configured
- **THEN** the explicit result and representation policy SHALL determine the available representations
- **AND** `jsonApi` SHALL NOT add the page props as an additional JSON representation

#### Scenario: Route policy overrides module policy

- **WHEN** route and module representation policies differ
- **THEN** the route policy SHALL determine representation availability for that route

## ADDED Requirements

### Requirement: Representation policy declares defaults and limits

Representation policy SHALL allow applications to declare the enabled media types, default representation, payload limits, render deadline, cache policy, and public projection hooks at module level with tighter route overrides.

#### Scenario: Route tightens module limit

- **WHEN** a route declares a smaller payload limit than the module
- **THEN** the route limit SHALL apply

#### Scenario: Route attempts to weaken mandatory policy

- **WHEN** host configuration marks a security policy as mandatory and a route attempts to weaken it
- **THEN** policy resolution SHALL fail with a configuration error before the route writes a response

#### Scenario: Route attempts to weaken enforced limits

- **WHEN** module policy sets serialization mode to `enforce`
- **AND** route policy attempts to set it to `warn` or raise a configured limit or deadline
- **THEN** policy resolution SHALL fail with a configuration error
