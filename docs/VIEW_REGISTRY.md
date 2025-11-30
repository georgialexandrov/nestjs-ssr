# Auto-Generated View Registry

## Overview

The view registry automatically discovers and registers all React view components, eliminating the need for manual imports and registry maintenance in `entry-server.tsx` and `entry-client.tsx`.

## How It Works

### 1. Vite Plugin (`src/view/view-registry-plugin.ts`)

The Vite plugin runs during development and build:
- Scans `src/**/views/*.tsx` for view files
- Excludes `shared/views/**` (component library, not page views)
- Generates `src/view/view-registry.generated.ts` with imports and registry
- Watches for file additions/deletions and triggers HMR

### 2. Standalone Script (`scripts/generate-view-registry.ts`)

Runs before TypeScript compilation via package.json hooks:
- Ensures registry exists before NestJS compilation starts
- Same logic as Vite plugin
- Required for `pnpm start:dev` and `pnpm build`

### 3. Generated Registry File

**Location:** `src/view/view-registry.generated.ts` (gitignored)

**Contents:**
```typescript
import AppViewsHome from '../app/views/home';
import UsersViewsUserList from '../users/views/user-list';
import UsersViewsUserProfile from '../users/views/user-profile';

export const viewRegistry: Record<string, React.ComponentType<any>> = {
  'app/views/home': AppViewsHome,
  'users/views/user-list': UsersViewsUserList,
  'users/views/user-profile': UserProfileView,
};

export function getRegisteredViews(): string[] {
  return Object.keys(viewRegistry);
}

export function isViewRegistered(path: string): boolean {
  return path in viewRegistry;
}
```

## Usage

### Creating a New View

Simply create a `.tsx` file in any module's `views/` directory:

```bash
src/
  users/
    views/
      user-settings.tsx  # ← New view
```

The view is automatically:
1. Discovered by the plugin
2. Added to the registry
3. Available for routing (no manual imports needed)

### View Naming Convention

File paths are converted to component names:
- **File:** `users/views/user-profile.tsx`
- **Component Name:** `UsersViewsUserProfile`
- **Registry Key:** `'users/views/user-profile'`

Hyphens are converted to underscores for valid identifiers:
- **File:** `app/views/my-awesome-view.tsx`
- **Component Name:** `AppViewsMyAwesomeView`

### Accessing the Registry

```typescript
import { viewRegistry, isViewRegistered, getRegisteredViews } from './view-registry.generated';

// Check if view exists
if (isViewRegistered('users/views/user-profile')) {
  const Component = viewRegistry['users/views/user-profile'];
}

// Get all registered views
const allViews = getRegisteredViews();
// => ['app/views/home', 'users/views/user-list', 'users/views/user-profile']
```

## Configuration

### Package.json Scripts

```json
{
  "scripts": {
    "generate:registry": "tsx scripts/generate-view-registry.ts",
    "prestart:dev": "pnpm generate:registry",
    "prebuild": "pnpm generate:registry && ..."
  }
}
```

### Vite Config

```typescript
import { viewRegistryPlugin } from './src/view/view-registry-plugin';

export default defineConfig({
  plugins: [
    viewRegistryPlugin(), // Must be before react()
    react({}),
  ],
});
```

### .gitignore

```
# Auto-generated files
src/view/view-registry.generated.ts
```

### TypeScript Config

```json
{
  "exclude": ["scripts", ...]
}
```

Excludes the standalone script from NestJS compilation (it uses ESM syntax).

## Hot Module Replacement (HMR)

The plugin watches for view file changes:

**Adding a view:**
```bash
# Create new file
touch src/app/views/test.tsx

# Plugin detects change
[view-registry] Generated registry with 4 views

# HMR triggers full reload
```

**Removing a view:**
```bash
# Delete file
rm src/app/views/test.tsx

# Plugin detects deletion
[view-registry] View removed: src/app/views/test.tsx
[view-registry] Generated registry with 3 views
```

## File Exclusions

### Excluded Patterns

- `shared/views/**` - Reusable components (not page views)

### Why Exclude shared/views?

These are component libraries (ErrorBoundary, Layout, etc.), not route-specific views:
- Often use named exports instead of default exports
- Not meant to be directly rendered by routes
- Should be imported explicitly where needed

## Benefits

### Before (Manual)

```typescript
// entry-server.tsx
import HomeView from '../app/views/home';
import UserListView from '../users/views/user-list';
import UserProfileView from '../users/views/user-profile';

const viewRegistry = {
  'app/views/home': HomeView,
  'users/views/user-list': UserListView,
  'users/views/user-profile': UserProfileView,
};

// entry-client.tsx (duplicate code)
import HomeView from '../app/views/home';
import UserListView from '../users/views/user-list';
// ... etc
```

Problems:
- Manual maintenance in 2 files
- Easy to forget adding new views
- Code duplication
- No type safety for registry keys

### After (Auto-Generated)

```typescript
// entry-server.tsx
import { viewRegistry } from './view-registry.generated';

// entry-client.tsx
import { viewRegistry } from './view-registry.generated';
```

Benefits:
- Zero manual maintenance
- Single source of truth
- Automatic discovery
- HMR integration
- Type-safe registry

## Troubleshooting

### Registry file not found

**Error:**
```
Cannot find module './view-registry.generated'
```

**Solution:**
Run the generation script manually:
```bash
pnpm generate:registry
```

### View not appearing in registry

**Checklist:**
1. File is in `src/**/views/*.tsx` (not `shared/views/`)
2. File has a default export
3. Registry was regenerated (check HMR logs)
4. No TypeScript errors in the view file

### Component name conflicts

If two views have the same name in different modules:
```
users/views/settings.tsx  → UsersViewsSettings
admin/views/settings.tsx  → AdminViewsSettings
```

The full path is used in the component name to avoid conflicts.

## Architecture Notes

**Why process.cwd() vs __dirname?**

The plugin uses `process.cwd()` to work correctly when:
1. Developing the framework locally (current phase)
2. Framework is installed as npm package in `node_modules`

When published to npm, `process.cwd()` resolves to the consumer's project root, not `node_modules/@yourorg/nest-ssr`, ensuring it scans consumer's views, not framework code.

See [NPM_PACKAGE_EXPORT.md](./NPM_PACKAGE_EXPORT.md) for details on future npm packaging.
