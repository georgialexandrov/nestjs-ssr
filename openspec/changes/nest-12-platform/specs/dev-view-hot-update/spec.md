## ADDED Requirements

### Requirement: View edits apply without restarting NestJS

In development, editing a page view or layout module SHALL NOT restart the NestJS process. The next server render SHALL use the edited module, and the open browser SHALL receive the change through Vite HMR.

#### Scenario: Editing a page view

- **WHEN** a developer changes the text rendered by `recipe-list.tsx` while the dev server is running
- **THEN** the open `/recipes` page SHALL show the new text within 2 seconds, without a full reload
- **AND** the NestJS process ID SHALL be unchanged

#### Scenario: Reloading after an edit

- **WHEN** the page is reloaded after a view edit
- **THEN** the server-rendered HTML SHALL contain the edited output
- **AND** hydration SHALL produce no mismatch warning

### Requirement: Non-view edits still restart

Editing a controller, module or service file in development SHALL continue to recompile and restart NestJS as it does today.

#### Scenario: Editing a controller

- **WHEN** a developer changes a controller's returned data
- **THEN** NestJS SHALL restart
- **AND** the next request SHALL reflect the change

### Requirement: Production behavior is unaffected

Outside development, components SHALL be rendered from the application's compiled imports and the server bundle, and no Vite module loading SHALL occur per request.

#### Scenario: Production render

- **WHEN** a page is rendered with `NODE_ENV=production`
- **THEN** no Vite dev server SHALL be created or consulted
