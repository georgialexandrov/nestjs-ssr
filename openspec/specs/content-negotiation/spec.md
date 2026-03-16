## ADDED Requirements

### Requirement: JSON response on Accept header

The system SHALL return a JSON response when the request includes `Accept: application/json` header and JSON API mode is enabled for the route.

#### Scenario: JSON response with Accept header

- **WHEN** a request to a `@Render()` route includes `Accept: application/json` header
- **AND** JSON API mode is enabled (module-level or route-level)
- **THEN** the response SHALL have `Content-Type: application/json`
- **AND** the response body SHALL be the exact object returned by the controller method (no wrapper, no metadata)

### Requirement: HTML rendering unchanged

The system SHALL continue to render HTML when no JSON-requesting headers are present, regardless of JSON API configuration.

#### Scenario: Normal HTML request with jsonApi enabled

- **WHEN** a request to a `@Render()` route includes `Accept: text/html` (or no Accept header)
- **AND** JSON API mode is enabled
- **THEN** the response SHALL be rendered HTML as before
- **AND** `Content-Type` SHALL be `text/html`

#### Scenario: Non-Render routes unaffected

- **WHEN** a request hits a controller method without `@Render()` decorator
- **THEN** the JSON API feature SHALL not intercept or modify the response

### Requirement: 406 when JSON API disabled

The system SHALL return `406 Not Acceptable` when a JSON response is requested but JSON API mode is disabled for the route.

#### Scenario: JSON request with jsonApi disabled globally

- **WHEN** a request includes `Accept: application/json`
- **AND** JSON API mode is not enabled (module default is false, no route override)
- **THEN** the response SHALL be `406 Not Acceptable`
- **AND** the body SHALL be `{ "error": "Not Acceptable", "message": "JSON response not available for this route" }`

#### Scenario: JSON request with jsonApi disabled per-route

- **WHEN** a request includes `Accept: application/json`
- **AND** JSON API mode is enabled at module level
- **BUT** the route has `@Render(Component, { jsonApi: false })`
- **THEN** the response SHALL be `406 Not Acceptable`

### Requirement: Segment requests take priority over JSON API

The system SHALL treat requests with `X-Current-Layouts` header as segment requests, not JSON API requests, even if `Accept: application/json` is present.

#### Scenario: Client navigation with Accept JSON

- **WHEN** a GET request includes both `X-Current-Layouts` header and `Accept: application/json`
- **THEN** the system SHALL handle it as a segment request (client-side navigation)
- **AND** SHALL NOT return the JSON API response format

### Requirement: Works with Express and Fastify

The JSON API response path SHALL work identically on both Express and Fastify HTTP adapters.

#### Scenario: Express adapter JSON response

- **WHEN** the application uses Express adapter
- **AND** a JSON API request is made
- **THEN** the response SHALL be valid JSON with correct Content-Type

#### Scenario: Fastify adapter JSON response

- **WHEN** the application uses Fastify adapter
- **AND** a JSON API request is made
- **THEN** the response SHALL be valid JSON with correct Content-Type
