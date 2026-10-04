# static-asset-serving Specification

## Purpose

TBD - created by archiving change 2026-09-28-render-pipeline-hardening. Update Purpose after archive.

## Requirements

### Requirement: Static assets are served from a startup-built index

In production, the system SHALL determine whether a request path corresponds to a file in the client build directory using an index built once at startup, rather than a filesystem check on every request.

#### Scenario: Known asset is served

- **WHEN** a request path matches a file present in the client build directory at startup
- **THEN** the system SHALL serve that file through the platform's static middleware

#### Scenario: Non-asset path skips the static middleware

- **WHEN** a request path does not match any file recorded in the startup index
- **THEN** the system SHALL NOT perform a filesystem check for that path before continuing to route handling

### Requirement: Build directory changes require a restart to take effect

The system SHALL NOT serve a file added to the client build directory after startup, and SHALL continue serving a file removed from the directory after startup, until the process restarts.

#### Scenario: File added while the server is running

- **WHEN** a file is added to the client build directory after the server has started
- **THEN** a request for that file's path SHALL NOT be served as a static asset until the server restarts

#### Scenario: Restart picks up the current directory contents

- **WHEN** the server restarts
- **THEN** the static-asset index SHALL be rebuilt from the client build directory's contents at that time
