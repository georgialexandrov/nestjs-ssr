import { defineConfig } from 'tsup';
import * as fs from 'fs';
import * as path from 'path';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/render/index.ts',
    'src/monitoring/index.ts',
    'src/vite/index.ts',
    'src/cli/init.ts',
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
  onSuccess: async () => {
    // Copy templates directory to dist
    const templatesDir = path.resolve('src/templates');
    const distTemplatesDir = path.resolve('dist/templates');

    if (fs.existsSync(templatesDir)) {
      // Create dist/templates directory
      if (!fs.existsSync(distTemplatesDir)) {
        fs.mkdirSync(distTemplatesDir, { recursive: true });
      }

      // Copy all files from src/templates to dist/templates
      const files = fs.readdirSync(templatesDir);
      files.forEach(file => {
        const srcFile = path.join(templatesDir, file);
        const destFile = path.join(distTemplatesDir, file);
        fs.copyFileSync(srcFile, destFile);
      });

      console.log('✓ Copied templates to dist/templates');
    }
  },
});
