## ADDED Requirements

### Requirement: Supported runtime matrix

The package SHALL declare peer dependencies of `^12` for `@nestjs/common` and `@nestjs/core`. It SHALL declare optional peers of `^12` for `@nestjs/platform-express` and `@nestjs/platform-fastify`, and a TypeScript peer range of `^6 || ^7`. Its `engines.node` range SHALL be `^20.19.0 || ^22.12.0 || >=24`.

#### Scenario: Installing into a Nest 12 application

- **WHEN** the package is installed into an application that depends on `@nestjs/core@12`
- **THEN** the package manager SHALL report no peer-dependency conflict for any `@nestjs/*` package

#### Scenario: Installing into a Nest 11 application

- **WHEN** the package is installed into an application that depends on `@nestjs/core@11`
- **THEN** the package manager SHALL report a peer-dependency conflict naming `@nestjs/core`

### Requirement: ESM-only package output

The published package SHALL contain only ES module JavaScript and type declarations. Every export-map entry SHALL provide `types` and `import` conditions and SHALL NOT provide a `require` condition.

#### Scenario: Importing from an ESM application

- **WHEN** an ESM Nest 12 application imports `@nestjs-ssr/react`, `@nestjs-ssr/react/client` and `@nestjs-ssr/react/render`
- **THEN** each import SHALL resolve to an `.mjs` or `.js` ES module with matching type declarations

#### Scenario: Loading from a CommonJS application

- **WHEN** a CommonJS Nest 12 application on a supported Node version calls `require('@nestjs-ssr/react')`
- **THEN** the module SHALL load through `require(esm)` and expose the same named exports as the ESM import

#### Scenario: Published tarball contents

- **WHEN** the package is packed for publishing
- **THEN** the tarball SHALL contain no CommonJS build output

### Requirement: CLI binary runs on supported Node

The `nestjs-ssr` binary SHALL execute as an ES module on every Node version in the supported range.

#### Scenario: Running init via npx

- **WHEN** a user runs `npx @nestjs-ssr/react init --help` on Node 22.12
- **THEN** the command SHALL print usage and exit with code 0
