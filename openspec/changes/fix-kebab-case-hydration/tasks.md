## 1. Fix normalizedFilename in entry-client.tsx

- [ ] 1.1 Add `toPascalCase` helper function that converts kebab-case to PascalCase using `filename.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())`
- [ ] 1.2 Replace inline normalization at line ~50-51 (componentMap builder) with `toPascalCase(filename)`
- [ ] 1.3 Replace layout lookup normalization at line ~174-178 to use `toPascalCase` for matching `normalizedFilename`

## 2. Sync example app entry-client.tsx

- [ ] 2.1 Apply the same fix to `examples/minimal/src/views/entry-client.tsx` if it has the same bug

## 3. Verify

- [ ] 3.1 Run unit tests (`pnpm test` in packages/react)
- [ ] 3.2 Run typecheck (`pnpm typecheck`)
