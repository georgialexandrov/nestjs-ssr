# client-navigation-integrity Specification

## Purpose

TBD - created by archiving change 2026-09-28-render-pipeline-hardening. Update Purpose after archive.

## Requirements

### Requirement: Overlapping navigations resolve latest-requested-wins

When more than one client-side navigation is in flight for the same page, the system SHALL apply only the response for the most recently requested navigation and SHALL discard responses for any navigation it superseded.

#### Scenario: Two navigations race

- **WHEN** a second call to `navigate()` starts before the first call's segment response has resolved
- **THEN** the system SHALL apply the second call's response when it resolves
- **AND** SHALL NOT apply the first call's response even if it resolves later

#### Scenario: A superseded navigation is not an error

- **WHEN** a navigation is superseded by a later one and its in-flight request is aborted
- **THEN** the system SHALL NOT surface the abort as a navigation error
- **AND** SHALL NOT change navigation state (for example a loading indicator) on behalf of the superseded call

### Requirement: Document head stays synced with the current page

Client-side navigation SHALL apply every head field the server can render for a page, including custom meta tags and link tags, and SHALL remove any head element the previous page added that the new page does not declare.

#### Scenario: Custom meta and link tags are applied

- **WHEN** a client-side navigation renders a page whose head data includes custom `meta` or `link` entries
- **THEN** the system SHALL add each entry to the document head, matching what a full page load of that page would render on the server

#### Scenario: A dropped tag is removed

- **WHEN** a client-side navigation moves from a page that set a custom head tag to a page that does not declare it
- **THEN** the system SHALL remove that tag from the document head

#### Scenario: Host-managed tags are left alone

- **WHEN** the document head contains a tag not added by a previous client-side navigation, for example one set by host page markup or a third-party script
- **THEN** the system SHALL NOT remove or modify that tag
