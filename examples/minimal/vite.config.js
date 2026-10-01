import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nestjsSsr } from '@nestjs-ssr/react/vite';
import { resolve } from 'path';

/**
 * Port of the Vite dev server. Must match the port NestJS proxies to —
 * `RenderModule.forRoot({ vite: { port: DEV_PORT } })` in src/app.module.ts.
 */
const DEV_PORT = Number(process.env.VITE_PORT ?? 5178);

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react({}), nestjsSsr()],
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
      // Connecting straight to Vite also keeps the HMR channel alive when
      // NestJS restarts (after a controller or service edit; `nestjs-ssr dev`
      // does not restart for view edits). A socket routed through NestJS
      // would be torn down by the restart and downgrade the next hot update
      // to a full page reload.
      clientPort: DEV_PORT,
    },
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
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
            client: resolve(import.meta.dirname, 'src/views/entry-client.tsx'),
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
