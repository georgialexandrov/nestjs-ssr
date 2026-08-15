import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// This file is .mjs, not .js: it uses ESM syntax, and the app's package.json
// has no "type": "module" (the NestJS build emits CommonJS). Loading ESM as
// CommonJS is what Vite's native config loader warns about, and that loader
// becomes the default in a future major.
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Port of the Vite dev server. Must match the port NestJS proxies to —
 * `RenderModule.forRoot({ vite: { port: DEV_PORT } })` in src/app.module.ts.
 */
const DEV_PORT = 5178;

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react({})],
  server: {
    port: DEV_PORT,
    // Fail loudly instead of silently sliding to 5179, which would leave the
    // NestJS proxy pointing at nothing.
    strictPort: true,
    ws: {
      // The page is served by NestJS on :3000, so the browser must be told
      // where the Vite dev server actually listens. Without this the client
      // derives the HMR socket from the page origin (ws://localhost:3000),
      // which NestJS does not answer with a handshake — and because Vite's
      // client awaits open/close with no timeout, a silent socket kills HMR
      // outright instead of falling back.
      //
      // Connecting straight to Vite also keeps the HMR channel alive across
      // `nest start --watch` restarts. That matters here: controllers import
      // their view components, so tsc recompiles and NestJS restarts on every
      // .tsx edit. A socket routed through NestJS would be torn down by that
      // restart and downgrade every hot update to a full page reload.
      clientPort: DEV_PORT,
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom', '@nestjs-ssr/react'],
  },
  ssr: {
    noExternal: ['@nestjs-ssr/react'],
  },
  build: {
    manifest: true,
    rollupOptions: {
      input: !isSsrBuild
        ? {
            client: resolve(__dirname, 'src/views/entry-client.tsx'),
          }
        : undefined,
      output: !isSsrBuild
        ? {
            manualChunks(id) {
              if (
                id.includes('node_modules/react/') ||
                id.includes('node_modules/react-dom/')
              ) {
                return 'vendor';
              }
            },
          }
        : {},
    },
  },
}));
