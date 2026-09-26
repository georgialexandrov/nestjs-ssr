## ADDED Requirements

### Requirement: One public payload boundary

The system SHALL project every client-visible HTML hydration state, JSON body, and segment payload through a common public-payload boundary before serialization.

#### Scenario: Private domain data is omitted by a projector

- **WHEN** a representation projector maps a domain value to a public DTO
- **THEN** HTML hydration, JSON, and segment serialization SHALL receive only the projected public graph
- **AND** SHALL NOT retain a reference to the original domain value

#### Scenario: Representation has a distinct DTO

- **WHEN** the HTML and JSON representations define different public projectors
- **THEN** each channel SHALL serialize only its selected projected DTO

### Requirement: Serialization is bounded and non-executable

In enforce mode, the system SHALL reject unsupported executable values, unsafe object shapes, and payloads exceeding configured depth or byte limits before committing response headers. The non-breaking default SHALL warn and preserve the existing value unchanged.

#### Scenario: Function occurs in public graph

- **WHEN** the projected public graph contains a function and enforce mode is enabled
- **THEN** serialization SHALL fail with a controlled server error
- **AND** development diagnostics SHALL identify the property path without logging the property value

#### Scenario: Payload exceeds route limit

- **WHEN** the serialized public graph exceeds the effective route or module byte limit and enforce mode is enabled
- **THEN** the system SHALL stop serialization and return the configured payload-limit server error

### Requirement: Request context is isolated and allowlisted

The system SHALL expose request headers and cookies in nested public context bags after canonicalization and allowlist enforcement, SHALL prevent them from overwriting base or application context properties, and SHALL permanently retain existing top-level header aliases.

#### Scenario: Allowed safe header

- **WHEN** `accept-language` is configured as an allowed header
- **THEN** its string value SHALL be available at `context.headers['accept-language']`
- **AND** the configured top-level alias SHALL remain available without a deprecation diagnostic

#### Scenario: Credential header is misconfigured

- **WHEN** a credential-bearing header such as `authorization`, `proxy-authorization`, `cookie`, or `set-cookie` appears in the configured allowlist
- **THEN** the system SHALL refuse to expose it
- **AND** SHALL report the unsafe configuration without including the credential value

#### Scenario: Header name collides with base context

- **WHEN** an allowed request header is named `url`, `path`, or `method`
- **THEN** it SHALL remain inside the headers bag
- **AND** SHALL NOT replace the corresponding base context value

### Requirement: Conservative response cache policy

When response policy is configured, the system SHALL apply `Cache-Control: private, no-store` to rendered representations unless a route explicitly declares a public cache policy. When it is not configured, the system SHALL emit no new cache or security headers.

#### Scenario: Authenticated page without cache metadata

- **WHEN** cache or security response policy is enabled and a rendered route does not declare public cache metadata
- **THEN** its HTML, JSON, and segment responses SHALL be private and non-storable

#### Scenario: Explicit public cache policy

- **WHEN** a route explicitly declares a public cache lifetime and cache keys
- **THEN** the system SHALL emit the public cache policy
- **AND** SHALL combine declared cache keys with all representation-selection fields in `Vary`

### Requirement: Security headers compose with the host application

The system SHALL support CSP nonce-based policy, `X-Content-Type-Options: nosniff`, and `Referrer-Policy` defaults without weakening an existing application-provided header.

#### Scenario: Host already set a stricter CSP

- **WHEN** host middleware sets a Content-Security-Policy header before rendering
- **THEN** the response policy SHALL preserve that header
- **AND** SHALL still apply non-conflicting configured security headers

### Requirement: Render deadlines have safe failure behavior

The system SHALL enforce configurable render deadlines and SHALL distinguish failures before and after response headers are committed.

#### Scenario: Deadline before commit

- **WHEN** a render deadline expires before response headers are committed
- **THEN** the system SHALL abort abort-aware work
- **AND** SHALL return a controlled `503 Service Unavailable` response

#### Scenario: Deadline after stream commit

- **WHEN** a render deadline expires after a streaming response has begun
- **THEN** the system SHALL abort and close the stream
- **AND** SHALL NOT inject a JSON or development error payload into the partial document

### Requirement: Segment DOM writes are centralized and validated

The client SHALL validate segment response schema, navigation target, and payload limits before applying server-rendered fragments through one DOM-update adapter.

#### Scenario: Invalid segment target

- **WHEN** a segment response names a swap target that is absent from the current layout tree
- **THEN** the client SHALL reject the fragment and perform a safe full navigation

#### Scenario: Trusted Types is enforced

- **WHEN** the browser enforces Trusted Types and a configured policy is available
- **THEN** the DOM-update adapter SHALL create and use a trusted HTML value
- **AND** no other library path SHALL assign segment HTML directly to an HTML injection sink
