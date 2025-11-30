import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { viewRegistryPlugin } from './src/view/view-registry-plugin';

export default defineConfig({
  plugins: [
    viewRegistryPlugin(), // Auto-generate view registry
    react({}),
  ],
  resolve: {
    alias: {
      '@view': resolve(__dirname, './src/view'),
      '@shared': resolve(__dirname, './src/shared'),
      '@users': resolve(__dirname, './src/users'),
    },
  },
  server: {
    middlewareMode: true,
    hmr: {
      // HMR will work through NestJS server
      port: 24678,
    },
  },
  appType: 'custom',
  build: {
    outDir: 'dist/client',
    // Enable asset hashing for cache busting
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        client: resolve(__dirname, 'src/view/entry-client.tsx'),
      },
      output: {
        // Add content hash to filenames for long-term caching
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
    // Generate manifest for SSR to map entry points
    manifest: true,
    // Optimize chunks
    chunkSizeWarningLimit: 500,
  },
});
