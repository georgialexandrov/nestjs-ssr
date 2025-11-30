# NPM Package Export - Future Implementation Notes

## Overview

When converting this framework to an npm package, several architectural considerations need to be addressed to ensure proper separation between framework code and consumer applications.

## Critical Changes Required

### 1. View Registry Generation

**Current State:**
- Plugin and script use `__dirname` which won't work when installed in `node_modules`
- Registry generated in framework's own `src/view/` directory

**Required Changes:**
- Update `scripts/generate-view-registry.ts` to use `process.cwd()` instead of `__dirname`
- Ensure plugin scans consumer's project, not framework's code
- Consumer's generated registry should live in their project root

**Implementation:**
```typescript
// scripts/generate-view-registry.ts
const REGISTRY_FILE = path.resolve(process.cwd(), 'src/view/view-registry.generated.ts');
const SRC_DIR = path.resolve(process.cwd(), 'src');
```

### 2. Vite Configuration Helper

**Problem:**
Requiring consumers to manually configure Vite with all necessary plugins and settings is error-prone.

**Solution: `defineNestSSRConfig` Helper**

Create a helper function that provides opinionated defaults while allowing customization:

```typescript
// src/vite/index.ts (to be created)
import { defineConfig, UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { viewRegistryPlugin } from '../view/view-registry-plugin';

export function defineNestSSRConfig(userConfig?: UserConfig) {
  return defineConfig({
    plugins: [
      viewRegistryPlugin(), // Auto-included
      react({}),
      ...(userConfig?.plugins || []),
    ],
    resolve: {
      alias: {
        '@view': resolve(process.cwd(), './src/view'),
        '@shared': resolve(process.cwd(), './src/shared'),
        ...(userConfig?.resolve?.alias || {}),
      },
    },
    server: {
      middlewareMode: true,
      hmr: { port: 24678 },
      ...(userConfig?.server || {}),
    },
    appType: 'custom',
    build: {
      outDir: 'dist/client',
      assetsDir: 'assets',
      rollupOptions: {
        input: {
          client: resolve(process.cwd(), 'src/view/entry-client.tsx'),
        },
        output: {
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
        },
      },
      manifest: true,
      chunkSizeWarningLimit: 500,
      ...(userConfig?.build || {}),
    },
  });
}
```

**Consumer Usage:**
```typescript
// Consumer's vite.config.ts
import { defineNestSSRConfig } from '@yourorg/nest-ssr/vite';

export default defineNestSSRConfig({
  // Optional: any custom overrides
  server: {
    port: 5173,
  },
});
```

**Benefits:**
- **Ease of use**: Single import, minimal configuration
- **Flexibility**: Consumers can override any setting
- **Less intrusive**: Clear they're using a framework helper
- **Convention over configuration**: Good defaults with escape hatches
- **Similar to popular frameworks**: Next.js, Remix use this pattern

### 3. Package Structure

**Export Paths:**
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./vite": "./dist/vite/index.js",
    "./view": "./dist/view/index.js",
    "./render": "./dist/shared/render/index.js"
  }
}
```

### 4. Entry Points to Export

**Framework Core:**
- `entry-server.tsx` (consumers import this)
- `entry-client.tsx` (consumers import this)
- `app.tsx` (base App component)

**Utilities:**
- `viewRegistryPlugin` from `src/view/view-registry-plugin.ts`
- `defineNestSSRConfig` from `src/vite/index.ts` (to be created)
- Render interfaces and types
- Error reporting utilities

**Consumer Must Provide:**
- Their own views in `src/**/views/*.tsx`
- Their own NestJS controllers
- Their own services and modules
- `view-registry.generated.ts` (auto-generated, not committed)

### 5. Documentation for Consumers

**Getting Started:**
```bash
npm install @yourorg/nest-ssr
```

**Minimal Setup:**

1. **vite.config.ts:**
```typescript
import { defineNestSSRConfig } from '@yourorg/nest-ssr/vite';
export default defineNestSSRConfig();
```

2. **package.json scripts:**
```json
{
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "predev": "nest-ssr generate-registry",
    "prebuild": "nest-ssr generate-registry"
  }
}
```

3. **Create views:** Simply create `.tsx` files in any `src/**/views/` directory

## Implementation Priority

1. ✅ Develop and test features in monorepo (current phase)
2. Update scripts to use `process.cwd()`
3. Create `defineNestSSRConfig` helper
4. Set up proper package.json exports
5. Write comprehensive consumer documentation
6. Create example/starter project
7. Test as installed dependency
8. Publish to npm

## Notes

- Keep reference implementations in the repo as examples
- Test the framework by installing it as a local dependency first
- Document all required peer dependencies
- Provide migration guide for existing projects
