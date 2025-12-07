import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viewRegistryPlugin } from '@nestjs-ssr/react/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    viewRegistryPlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
  build: {
    outDir: 'dist/client',
    manifest: true,
    rollupOptions: {
      input: {
        client: resolve(__dirname, 'src/entry-client.tsx'),
      },
    },
  },
});
