## 1. Fix normalizedFilename in entry-client.tsx

- [x] 1.1 Add `toPascalCase` helper function that converts kebab-case to PascalCase using `filename.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())`
- [x] 1.2 Replace inline normalization at line ~50-51 (componentMap builder) with `toPascalCase(filename)`
- [x] 1.3 Replace layout lookup normalization at line ~174-178 to use `toPascalCase` for matching `normalizedFilename` (already uses componentMap which now has correct normalizedFilename)

## 2. Sync example app entry-client.tsx

- [x] 2.1 Apply the same fix to `examples/minimal/src/views/entry-client.tsx` if it has the same bug

## 3. Verify

- [x] 3.1 Run unit tests (`pnpm test` in packages/react)
- [x] 3.2 Run typecheck (`pnpm typecheck`)
