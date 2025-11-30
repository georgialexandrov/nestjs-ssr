import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/render/index.ts',
    'src/monitoring/index.ts',
    'src/vite/index.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: [
    '@nestjs/common',
    '@nestjs/core',
    '@nestjs/platform-express',
    'react',
    'react-dom',
    'react-dom/server',
    'react/jsx-runtime',
    'vite',
    'rxjs',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
