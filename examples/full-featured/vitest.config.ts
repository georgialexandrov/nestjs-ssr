/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use happy-dom for faster DOM simulation (or jsdom if you prefer)
    environment: 'happy-dom',

    // Global test utilities
    globals: true,

    // Setup files to run before tests
    setupFiles: ['./src/view/test/setup.ts'],

    // Type checking
    typecheck: {
      enabled: false, // Disable type checking during tests for performance
    },

    // Include only view layer tests
    include: ['src/**/views/**/*.{test,spec}.{ts,tsx}', 'src/view/**/*.{test,spec}.{ts,tsx}'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/views/**/*.{ts,tsx}', 'src/view/**/*.{ts,tsx}'],
      exclude: [
        '**/*.{test,spec}.{ts,tsx}',
        '**/test/**',
        '**/node_modules/**',
        '**/dist/**',
      ],
    },

    // UI for interactive test running
    ui: true,
  },

  resolve: {
    alias: {
      '@view': resolve(__dirname, './src/view'),
      '@shared': resolve(__dirname, './src/shared'),
      '@users': resolve(__dirname, './src/users'),
      '@': resolve(__dirname, './src'),
    },
  },
});
