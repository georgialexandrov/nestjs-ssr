import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viewRegistryPlugin } from '@nestjs-ssr/react/vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    viewRegistryPlugin(),
    // Copy index.html to dist/client after build
    {
      name: 'copy-template',
      closeBundle() {
        try {
          mkdirSync('dist/client', { recursive: true });
          copyFileSync('src/view/index.html', 'dist/client/index.html');
          console.log('✓ Copied index.html to dist/client');
        } catch (error) {
          console.error('Failed to copy index.html:', error);
        }
      }
    }
  ],
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
        client: resolve(__dirname, 'src/view/entry-client.tsx'),
      },
    },
  },
});
