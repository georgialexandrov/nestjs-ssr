import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viewRegistryPlugin } from '@nestjs-ssr/react/vite';
import { resolve } from 'path';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    react(),
    viewRegistryPlugin(),
  ],
  build: {
    manifest: true,
    rollupOptions: {
      input: !isSsrBuild
        ? {
          client: resolve(__dirname, 'src/view/entry-client.tsx'),
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
