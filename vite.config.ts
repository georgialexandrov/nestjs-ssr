import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react({})],
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
    rollupOptions: {
      input: {
        client: resolve(__dirname, 'src/view/entry-client.tsx'),
      },
    },
  },
});
