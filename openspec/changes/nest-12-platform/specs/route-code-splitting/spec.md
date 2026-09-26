## ADDED Requirements

### Requirement: Views load per route on the client

The generated client entry SHALL load page view modules lazily, one module per view. Layout modules SHALL remain eagerly loaded.

#### Scenario: Production build of the example

- **WHEN** the example is built for production
- **THEN** each page view SHALL be emitted in its own chunk, separate from the entry chunk

### Requirement: Server preloads the active route

When rendering HTML, the system SHALL emit `modulepreload` links for:

- the rendered view's chunk;
- the chunks that view statically imports;
- stylesheet links for that view's CSS.

These links SHALL come from the Vite manifest in production and the Vite module graph in development, and SHALL carry the configured CSP nonce.

#### Scenario: Rendering a page in production

- **WHEN** `/recipes` is rendered in production
- **THEN** the HTML head SHALL contain a `modulepreload` link for the recipe-list view chunk
- **AND** SHALL NOT contain preload links for unrelated views

#### Scenario: CSP nonce configured

- **WHEN** a CSP nonce is configured for the request
- **THEN** every emitted preload and script tag SHALL carry that nonce

### Requirement: Hydration waits only for the current route

The client SHALL hydrate after loading the current route's view module and SHALL NOT wait for any other view module. The hydrated tree SHALL match the server-rendered markup without hydration errors.

#### Scenario: First load hydrates without mismatch

- **WHEN** a production page is loaded in the browser
- **THEN** hydration SHALL complete with no React hydration warnings in the console

### Requirement: Navigation prefetches route chunks

Client-side navigation SHALL begin loading the target view's chunk no later than when the segment request starts, and SHALL begin on link hover or focus when prefetching is enabled.

#### Scenario: Navigating between routes

- **WHEN** the user clicks a `Link` to a route whose chunk is not loaded
- **THEN** the new view SHALL render after both the segment payload and the chunk resolve, with no full page reload

### Requirement: Backward-compatible fallback

When a view module cannot be mapped to a manifest entry, the system SHALL fall back to rendering without a route preload and SHALL log a single development warning. This happens, for example, in a project whose Vite config lacks the module-id plugin.

#### Scenario: Project without the module-id plugin

- **WHEN** a project upgraded without regenerating its Vite config renders a page in development
- **THEN** the page SHALL render and hydrate correctly
- **AND** one warning SHALL name the missing plugin
