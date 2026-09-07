## MODIFIED Requirements

### Requirement: JSON response on Accept header

The system SHALL select JSON when JSON is enabled for the route and is the most preferred compatible representation according to the parsed Accept header.

#### Scenario: JSON response with Accept header

- **WHEN** a request to a rendered route includes `Accept: application/json`
- **AND** JSON is enabled for the route
- **THEN** the response SHALL have `Content-Type: application/json`
- **AND** the response body SHALL be the selected public JSON representation

#### Scenario: Quality value prefers HTML

- **WHEN** a request includes `Accept: text/html, application/json;q=0.5`
- **AND** both representations are enabled
- **THEN** the system SHALL select HTML

#### Scenario: JSON is explicitly excluded

- **WHEN** a request includes `Accept: application/json;q=0, text/html;q=0.8`
- **THEN** the system SHALL NOT select JSON
- **AND** SHALL select HTML when it is enabled

#### Scenario: Structured JSON suffix

- **WHEN** a request accepts a supported `application/*+json` media type
- **AND** the route enables JSON
- **THEN** the system SHALL select the JSON representation using the negotiated compatible media type

### Requirement: HTML rendering unchanged

The system SHALL render HTML when HTML is the preferred enabled representation, including when the Accept header is absent or contains only an equally ranked wildcard.

#### Scenario: Normal HTML request with JSON enabled

- **WHEN** a request to a rendered route includes `Accept: text/html`, omits Accept, or accepts only `*/*`
- **AND** HTML is the route default
- **THEN** the response SHALL be rendered HTML
- **AND** `Content-Type` SHALL be `text/html`

#### Scenario: Non-Render routes unaffected

- **WHEN** a request hits a controller method without a render decorator
- **THEN** representation negotiation SHALL NOT intercept or modify the response

### Requirement: 406 when JSON API disabled

The system SHALL return `406 Not Acceptable` when none of the route's enabled representations match the request's acceptable media ranges.

#### Scenario: JSON request with JSON disabled globally

- **WHEN** a request includes `Accept: application/json`
- **AND** JSON is not enabled for the route
- **AND** no other enabled representation matches
- **THEN** the response SHALL be `406 Not Acceptable`
- **AND** the body SHALL identify the enabled media types without exposing controller data

#### Scenario: JSON request with JSON disabled per-route

- **WHEN** a request includes `Accept: application/json`
- **AND** module policy enables JSON
- **BUT** route policy disables JSON
- **THEN** the response SHALL be `406 Not Acceptable` when no other acceptable representation is enabled

### Requirement: Segment requests take priority over JSON API

The system SHALL treat a valid client-navigation segment request as a segment request rather than normal JSON API negotiation, even if JSON is accepted.

#### Scenario: Client navigation with Accept JSON

- **WHEN** a GET request includes a valid `X-Current-Layouts` header and accepts JSON
- **THEN** the system SHALL handle it as a segment request
- **AND** SHALL derive the segment from the HTML representation
- **AND** SHALL NOT return the JSON API representation

#### Scenario: Invalid segment header

- **WHEN** a request includes an invalid or over-limit `X-Current-Layouts` header
- **THEN** the header SHALL NOT activate the segment protocol
- **AND** normal Accept negotiation SHALL continue

### Requirement: Works with Express and Fastify

Representation negotiation SHALL produce equivalent results on Express and Fastify HTTP adapters.

#### Scenario: Express adapter JSON response

- **WHEN** the application uses Express and JSON is negotiated
- **THEN** the response SHALL contain the selected public JSON representation with the negotiated status and headers

#### Scenario: Fastify adapter JSON response

- **WHEN** the application uses Fastify and JSON is negotiated
- **THEN** the response SHALL contain the selected public JSON representation with the same status and header semantics as Express

## ADDED Requirements

### Requirement: Negotiation metadata is cache-correct

The system SHALL append every request-header field capable of changing the representation to `Vary` without replacing existing `Vary` values.

#### Scenario: HTML and JSON are available

- **WHEN** a rendered route can serve HTML and JSON
- **THEN** the response SHALL include `Accept` in `Vary`

#### Scenario: Client navigation is enabled

- **WHEN** client-navigation segments are enabled
- **THEN** rendered responses SHALL include `X-Current-Layouts` in `Vary`

### Requirement: Negotiation is deterministic

The system SHALL rank acceptable representations by quality, media-range specificity, client order, and finally the route's declared default.

#### Scenario: Equal quality with different specificity

- **WHEN** two compatible media ranges have equal quality but one is more specific
- **THEN** the more specific range SHALL determine the selected representation
