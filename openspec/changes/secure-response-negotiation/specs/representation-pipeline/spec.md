## ADDED Requirements

### Requirement: Explicit representation results

The system SHALL provide branded, type-safe response factories through which a rendered controller can offer independent HTML and JSON representations without inspecting request headers.

#### Scenario: Controller offers distinct page and API DTOs

- **WHEN** a rendered controller returns an explicit representation result with an HTML page value and a JSON API value
- **THEN** the system SHALL preserve the independent static types of both values
- **AND** SHALL evaluate and serialize only the selected representation

#### Scenario: Domain object resembles framework control data

- **WHEN** a plain controller object contains properties named `html` or `json` but was not created by a representation factory
- **THEN** the system SHALL treat it as application data rather than framework control data

### Requirement: Adapter-neutral response pipeline

The system SHALL process rendered responses through independently testable negotiation, public projection, rendering, response-policy, and HTTP-writing stages.

#### Scenario: Same result on Express and Fastify

- **WHEN** equivalent requests and controller results are handled through Express and Fastify
- **THEN** the response status, media type, cache policy, negotiation metadata, and body semantics SHALL be equivalent

#### Scenario: Headers are written centrally

- **WHEN** a renderer returns a completed representation
- **THEN** only the HTTP response writer SHALL commit representation headers and the response body

### Requirement: Segment representation derives from HTML

The system SHALL derive client-navigation segments from the explicit HTML page representation rather than requiring controllers to author a separate segment value.

#### Scenario: Segment request selects HTML page data

- **WHEN** a valid segment request targets a controller that offers HTML and JSON representations
- **THEN** the system SHALL derive the segment from the HTML page props, layouts, context, and head data
- **AND** SHALL NOT expose the JSON API DTO as the segment payload

### Requirement: Existing result compatibility

The system SHALL adapt plain page props, `RenderResponse`, and `jsonApi` configuration to the new pipeline as permanently supported contracts.

#### Scenario: Existing plain-props controller

- **WHEN** an existing `@Render()` controller returns plain props
- **THEN** the result adapter SHALL create an HTML page representation with behavior equivalent to the current release

#### Scenario: Existing JSON API route remains supported

- **WHEN** an existing route enables `jsonApi` and returns page props
- **THEN** the result adapter SHALL offer those props as JSON
- **AND** SHALL NOT emit deprecation or migration guidance

### Requirement: Controller strings are not implicit renderer output

The system SHALL distinguish controller return values from internal renderer output and SHALL preserve raw-string passthrough on `@Render()` routes.

#### Scenario: Raw-string passthrough

- **WHEN** a rendered controller returns a raw string
- **THEN** the system SHALL preserve current passthrough behavior
- **AND** SHALL NOT emit a deprecation warning or require a compatibility flag

### Requirement: Representation work is cancellable

The system SHALL propagate one request-scoped abort signal and deadline through lazy projection, rendering, and response writing.

#### Scenario: Request disconnects during stream rendering

- **WHEN** the client disconnects before stream rendering completes
- **THEN** the system SHALL abort the renderer and any abort-aware representation work
- **AND** SHALL release request-scoped resources
