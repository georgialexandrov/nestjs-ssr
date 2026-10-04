# Spec Delta

## ADDED Requirements

### Requirement: ETag is omitted for non-cacheable responses

When the system applies a `no-store` response cache policy, it SHALL NOT emit an `ETag` response header. When a route declares a public, cacheable response policy, `ETag` and conditional-request (`304`) behavior SHALL be unchanged.

#### Scenario: Default no-store response

- **WHEN** a route uses the library's default response cache policy
- **THEN** the rendered response SHALL be sent without an `ETag` header

#### Scenario: Explicit public cache policy retains ETag

- **WHEN** a route declares a public cache lifetime per the "Conservative response cache policy" requirement
- **THEN** the response SHALL include an `ETag` header
- **AND** a matching `If-None-Match` request SHALL still receive a `304 Not Modified` response

## MODIFIED Requirements

### Requirement: Render deadlines have safe failure behavior

The system SHALL enforce exactly one effective render deadline per request and SHALL distinguish failures before and after response headers are committed. When more than one deadline source is configured for a request, the system SHALL use the most restrictive (shortest) of the configured values as the effective deadline.

#### Scenario: Deadline before commit

- **WHEN** a render deadline expires before response headers are committed
- **THEN** the system SHALL abort abort-aware work
- **AND** SHALL return a controlled `503 Service Unavailable` response

#### Scenario: Deadline after stream commit

- **WHEN** a render deadline expires after a streaming response has begun
- **THEN** the system SHALL abort and close the stream
- **AND** SHALL NOT inject a JSON or development error payload into the partial document

#### Scenario: Module and route deadlines are both configured

- **WHEN** a module-level render timeout and a route-level representation deadline are both configured with different values
- **THEN** the system SHALL use the shorter of the two as the effective deadline for that route
- **AND** SHALL NOT apply the longer value independently
