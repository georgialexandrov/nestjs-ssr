## ADDED Requirements

### Requirement: Supported runtime matrix

The package SHALL declare peer dependencies of `^11.0.0 || ^12.0.0` for `@nestjs/common` and `@nestjs/core`. It SHALL declare optional peers of the same range for `@nestjs/platform-express` and `@nestjs/platform-fastify`, and a TypeScript peer range of `^5.0.0 || ^6.0.0 || ^7.0.0`. The package SHALL NOT narrow any peer or engine range it declared in 0.3.31, with one exception: the Vite peer range SHALL be `^7.0.0 || ^8.0.0`. Vite 6's default build target does not support top-level `await`, which the route-splitting client entry uses; Vite 6 is dropped in the 0.4 feature release.

#### Scenario: Installing into a Nest 12 application

- **WHEN** the package is installed into an application that depends on `@nestjs/core@12`
- **THEN** the package manager SHALL report no peer-dependency conflict for any `@nestjs/*` package

#### Scenario: Installing alongside Vite 6

- **WHEN** the package is installed into an application that depends on `vite@6`
- **THEN** the package manager SHALL report a peer-dependency conflict for `vite`
- **AND** the upgrade guide SHALL tell the application to move to Vite 7 or 8

#### Scenario: Installing into a Nest 11 application

- **WHEN** the package is installed into an application that depends on `@nestjs/core@11`
- **THEN** the package manager SHALL report no peer-dependency conflict
- **AND** the application SHALL render, hydrate and navigate exactly as it did on 0.3.31

### Requirement: Lifecycle inside a Nest application

Static file serving (production) and the Vite proxy (development) SHALL run ahead of the application's routes. A production shutdown SHALL NOT close connections that are still being answered; draining is left to Nest.

#### Scenario: An application with a catch-all route

- **WHEN** the application registers `@Get('*path')` and a browser requests a built asset or a Vite module
- **THEN** the asset or module SHALL be served, and every other path SHALL still reach the catch-all route

#### Scenario: Shutdown with a request in flight

- **WHEN** a production application is closed while a request is being handled
- **THEN** that request SHALL receive its complete response

### Requirement: Dual package output is preserved

The published package SHALL keep providing both ES module and CommonJS builds, with the export-map entry points and condition names of 0.3.31. Every subpath exported in 0.3.31 SHALL remain exported.

#### Scenario: Importing from an ESM application

- **WHEN** an ESM application imports `@nestjs-ssr/react`, `@nestjs-ssr/react/client` and `@nestjs-ssr/react/render`
- **THEN** each import SHALL resolve to an ES module with matching type declarations

#### Scenario: Requiring from a CommonJS application

- **WHEN** a CommonJS Nest 11 or Nest 12 application calls `require('@nestjs-ssr/react')`
- **THEN** it SHALL load the CommonJS build and expose the same named exports as the ESM import

### Requirement: Existing application code keeps working

Application code, generated files (`entry-client.tsx`, `entry-server.tsx`, `index.html`, `vite.config`) and configuration written for 0.3.31 SHALL work unchanged. New behavior that needs changes to generated files SHALL be opt-in or SHALL fall back to the 0.3.31 behavior when those changes are absent.

#### Scenario: Upgrading without regenerating files

- **WHEN** an application created with `init` from 0.3.31 upgrades the package and changes nothing else
- **THEN** every page SHALL render, hydrate and navigate as before
- **AND** every response SHALL keep its status, headers and body semantics
