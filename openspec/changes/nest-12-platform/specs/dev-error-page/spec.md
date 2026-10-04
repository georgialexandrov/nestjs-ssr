## ADDED Requirements

### Requirement: Development error page content

When rendering fails in development, the system SHALL respond with an error page that shows:

- the error name and message;
- a source-mapped stack trace;
- a code frame of the failing source line;
- the React component stack when available;
- the request method and path;
- the controller class and handler name;
- the view module identifier.

#### Scenario: Component throws during render

- **WHEN** a page component throws during server rendering in development
- **THEN** the response SHALL be the development error page
- **AND** the stack SHALL reference the original `.tsx` source file and line rather than transformed output

### Requirement: Development error page interactions

The development error page SHALL provide:

- a control that copies a plain-text report of the error to the clipboard;
- an "open in editor" link to the failing file and line through the Vite dev server;
- light and dark themes following `prefers-color-scheme`.

The page SHALL be self-contained, with no external stylesheet or script requests.

#### Scenario: Viewing the error page offline

- **WHEN** the development error page is displayed with network access blocked
- **THEN** it SHALL render fully styled

### Requirement: No diagnostics outside development

Outside development, render errors SHALL produce the production error page. That page SHALL contain no stack trace, source excerpt, file path, component stack or controller name.

#### Scenario: Component throws in production

- **WHEN** a page component throws with `NODE_ENV=production`
- **THEN** the response body SHALL contain none of: the error stack, the source file path, or the controller name
