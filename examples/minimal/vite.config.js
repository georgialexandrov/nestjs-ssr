import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
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
            manualChunks: {
              vendor: ['react', 'react-dom'],
            },
          }
        : {},
    },
  },
}));
