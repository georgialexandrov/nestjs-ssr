## ADDED Requirements

### Requirement: Kebab-case filenames normalize to PascalCase for component matching

The client-side hydration SHALL convert kebab-case view filenames to PascalCase when building the `normalizedFilename` used for component matching. The conversion MUST capitalize the first letter and every letter following a hyphen, removing all hyphens.

#### Scenario: Simple kebab-case filename

- **WHEN** a view file is named `login-page.tsx`
- **THEN** `normalizedFilename` SHALL be `LoginPage`

#### Scenario: Multi-segment kebab-case filename

- **WHEN** a view file is named `user-profile-settings.tsx`
- **THEN** `normalizedFilename` SHALL be `UserProfileSettings`

#### Scenario: Single-word filename (no hyphens)

- **WHEN** a view file is named `home.tsx`
- **THEN** `normalizedFilename` SHALL be `Home` (existing behavior preserved)

#### Scenario: Already PascalCase filename

- **WHEN** a view file is named `LoginPage.tsx`
- **THEN** `normalizedFilename` SHALL be `LoginPage` (no change needed, first char already uppercase, no hyphens)

### Requirement: Layout lookup uses the same PascalCase normalization

The layout resolution logic SHALL use the same kebab-case to PascalCase normalization as the component lookup, ensuring layouts with kebab-case filenames can be matched in production builds.

#### Scenario: Kebab-case layout filename in production

- **WHEN** a layout file is named `admin-layout.tsx` and the server sends `AdminLayout` in `__LAYOUTS__`
- **THEN** the client SHALL match the layout via `normalizedFilename` of `AdminLayout`

#### Scenario: Layout lookup fallback chain

- **WHEN** the server sends a layout name that doesn't match any component's `name` property (due to minification)
- **THEN** the client SHALL fall back to matching by `normalizedFilename` (PascalCase) or `filename` (lowercase)
