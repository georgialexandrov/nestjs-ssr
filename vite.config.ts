import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import viteCompression from 'vite-plugin-compression';
import Inspect from 'vite-plugin-inspect';
import { viewRegistryPlugin } from './src/view/view-registry-plugin';

export default defineConfig({
  plugins: [
    viewRegistryPlugin(), // Auto-generate view registry
    react({}),
    // Vite plugin inspector - access at http://localhost:5173/__inspect/
    Inspect(),
    // Bundle analysis - generates stats.html
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
    // Gzip compression
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      deleteOriginFile: false,
    }),
    // Brotli compression (better compression, modern browsers)
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      deleteOriginFile: false,
    }),
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
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Minification settings
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      input: {
        client: resolve(__dirname, 'src/view/entry-client.tsx'),
      },
      output: {
        // Add content hash to filenames for long-term caching
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        // Advanced chunk splitting strategy
        manualChunks: (id) => {
          // Vendor chunk for node_modules
          if (id.includes('node_modules')) {
            // Separate React and React-DOM into their own chunk
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // All other dependencies in a vendor chunk
            return 'vendor';
          }
          // View components in separate chunks by module
          if (id.includes('/views/')) {
            const match = id.match(/src\/(.+?)\/views/);
            if (match) {
              return `views-${match[1]}`;
            }
          }
        },
      },
    },
    // Generate manifest for SSR to map entry points
    manifest: true,
    // Optimize chunks
    chunkSizeWarningLimit: 500,
    // Report compressed size
    reportCompressedSize: true,
  },
  // CSS code splitting
  css: {
    devSourcemap: true,
  },
});
