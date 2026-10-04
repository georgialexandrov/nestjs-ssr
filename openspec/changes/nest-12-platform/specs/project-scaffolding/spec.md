## ADDED Requirements

### Requirement: Interactive init

In an interactive terminal, `nestjs-ssr init` SHALL:

- prompt for SSR mode, whether to generate example pages, and whether to install dependencies;
- show progress for each step;
- finish with a summary of the created files and the next commands to run, using the detected package manager.

#### Scenario: Interactive run in a fresh Nest 12 project

- **WHEN** a user runs `init` in a project created by `nest new` and accepts the defaults
- **THEN** the project SHALL start with the printed dev command
- **AND** the welcome page SHALL render with SSR

### Requirement: Non-interactive init

`init` SHALL run without prompts when `--yes` is passed or when stdin is not a TTY. It SHALL accept `--mode`, `--pm`, `--skip-install`, `--no-examples` and `--force`.

#### Scenario: CI invocation

- **WHEN** `init --yes --pm pnpm --skip-install` runs with stdin not attached to a TTY
- **THEN** it SHALL complete without waiting for input and exit with code 0

### Requirement: Package manager detection

`init` SHALL detect the package manager from the project's lockfile, falling back to the invoking user agent, unless `--pm` is given.

#### Scenario: pnpm project

- **WHEN** `init` runs in a project containing `pnpm-lock.yaml`
- **THEN** dependencies SHALL be installed with pnpm
- **AND** the summary SHALL print pnpm commands

### Requirement: Idempotent init

Running `init` on a project that already contains generated files SHALL NOT overwrite them unless `--force` is passed, and SHALL report each skipped file.

#### Scenario: Second run

- **WHEN** `init` runs twice in the same project without `--force`
- **THEN** the second run SHALL leave every file unchanged
- **AND** it SHALL list the skipped files

### Requirement: Starter template

The generated starter SHALL include:

- a root layout with light and dark themes based on CSS custom properties, with a user toggle persisted in a cookie;
- a welcome page that explains the request-to-render flow and links to the documentation;
- a controller demonstrating `@Layout` and `@Render`.

It SHALL NOT add a CSS framework dependency.

#### Scenario: Theme toggle persists

- **WHEN** a user switches the starter to dark theme and reloads
- **THEN** the server-rendered HTML SHALL already use the dark theme, with no flash of the light theme
