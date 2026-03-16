## Why

Every `@Render()` route only returns HTML. If you need the same data as JSON — for a mobile app, an AI agent, a CLI tool, or any non-browser client — you duplicate the controller logic into a separate API endpoint. Content negotiation lets the same endpoint serve HTML to browsers and JSON to machines, eliminating that duplication.

## What Changes

- Add content negotiation to `RenderInterceptor`: when the request includes `Accept: application/json`, return the controller's data as JSON instead of rendering React
- JSON response: returns the controller's data object directly (same shape the React component receives as props)
- New module config option: `RenderModule.forRoot({ jsonApi: true | false })` — opt-in, default `false`
- Per-route override via `@Render(Component, { jsonApi: true | false })` — overrides module-level setting
- When `jsonApi` is disabled and a JSON request arrives, respond with `406 Not Acceptable`

## Capabilities

### New Capabilities

- `content-negotiation`: Header-based detection (`Accept: application/json`), JSON serialization of page props, 406 handling when disabled
- `json-api-config`: Module-level and per-route opt-in/opt-out configuration for JSON API mode

### Modified Capabilities

_None — no existing specs._

## Impact

- **Code**: `RenderInterceptor` (primary), `RenderModule` config, `RenderOptions` interface, `RenderConfig` interface
- **API surface**: New config option `jsonApi` on `RenderConfig` and `RenderOptions`. New response format (JSON) on existing routes when opted in
- **Dependencies**: None added
- **Breaking changes**: None. Default behavior unchanged (`jsonApi: false`)
