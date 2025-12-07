import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viewRegistryPlugin } from '@nestjs-ssr/react/vite';
import { resolve } from 'path';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    react(),
    viewRegistryPlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    manifest: true,
    rollupOptions: {
      input: !isSsrBuild
        ? {
            client: resolve(__dirname, 'node_modules/@nestjs-ssr/react/src/templates/entry-client.tsx'),
          }
        : undefined,
      output: !isSsrBuild
        ? {
            manualChunks: {
              vendor: ['react', 'react-dom'],
            },
          }
        : {},
    },
  },
}));
