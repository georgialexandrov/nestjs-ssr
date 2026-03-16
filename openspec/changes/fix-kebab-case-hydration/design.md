## Context

`entry-client.tsx` maps server-sent component names to client-side components using a `componentMap` built from Vite's `import.meta.glob`. The map includes three identifiers per component: `name` (from `Function.name`/`displayName`), `filename` (raw), and `normalizedFilename` (intended as PascalCase).

In production, Vite minifies function names, so `name` becomes useless (e.g., `"Sde"`). The fallback to `normalizedFilename` was meant to handle this, but the normalization is broken for kebab-case: it only uppercases the first character.

Two locations in the file do this lookup: component resolution (line ~65) and layout resolution (line ~174).

## Goals / Non-Goals

**Goals:**

- Fix `normalizedFilename` to correctly convert kebab-case filenames to PascalCase
- Apply the fix consistently to both component and layout lookup paths

**Non-Goals:**

- Changing how the server sends `__COMPONENT_NAME__` (that's a separate concern)
- Adding `displayName` injection via a Vite plugin (valid optimization, separate change)
- Fixing the normalization for other naming conventions (snake_case, etc.) — only kebab-case is broken and reported

## Decisions

**Single regex replacement over split-join approach**

`filename.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())` — handles both first char and post-hyphen chars in one pass. Alternative: `split('-').map(capitalize).join('')` — more readable but allocates intermediate arrays for no benefit. The regex is a well-known pattern and fits in one line.

**Extract to a shared helper function**

The same normalization logic appears in two places (component lookup and layout lookup). Extract to a `toPascalCase(filename)` function defined once in the file. Prevents future drift between the two paths.

## Risks / Trade-offs

- **[Low] Existing users with copied entry-client.tsx**: Users who ran `init` already have a copy. They need to manually update or re-run init. This is the existing pattern for template updates — no migration tooling exists. → Document in changelog.
- **[Low] Edge case: filenames with consecutive hyphens**: `my--page.tsx` → `MyPage` (double hyphen collapses). This is an unusual filename and the behavior is reasonable.
