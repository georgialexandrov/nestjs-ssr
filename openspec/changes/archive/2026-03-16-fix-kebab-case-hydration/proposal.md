## Why

Client-side hydration breaks in production for any view file with a kebab-case filename (e.g., `login-page.tsx`). The server sends `__COMPONENT_NAME__` using `Function.name`, which Vite minifies in production builds. The fallback filename normalization only capitalizes the first character (`login-page` → `Login-page`), so it never matches the server-sent PascalCase name. Same bug exists in layout lookup.

## What Changes

- Fix `normalizedFilename` computation in `entry-client.tsx` to convert kebab-case to PascalCase (`login-page` → `LoginPage`)
- Apply the same fix to the layout lookup logic in the same file

## Capabilities

### New Capabilities

- `kebab-case-hydration`: Correct PascalCase normalization of kebab-case filenames for component and layout matching during client-side hydration

### Modified Capabilities

## Impact

- **File**: `packages/react/src/templates/entry-client.tsx` (the template that gets copied into user projects via `npx @nestjs-ssr/react init`)
- Users with existing projects will need to regenerate or manually patch their `entry-client.tsx`
- No API changes, no dependency changes
