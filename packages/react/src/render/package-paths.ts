import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Locate a file shipped in this package's templates directory.
 *
 * The code calling this runs from several places, and each needs a
 * different relative path to reach the templates:
 * - `dist/` (the main entry and its shared chunks) → `dist/templates`
 * - `dist/render/` (the `./render` entry) → `dist/templates`
 * - `src/render/` (tests and tsx) → `src/templates`
 *
 * `__dirname` exists in both builds: natively in CommonJS, and in ESM
 * through the bundler's shim. Without the shim, an ESM application (every
 * `nest new` project on Nest 12) fails with a ReferenceError.
 *
 * Returns the first candidate that exists, or the first candidate when none
 * does, so error messages name a concrete expected location.
 */
export function packageTemplatePath(fileName: string): string {
  const candidates = packageTemplateCandidates(fileName);
  return candidates.find((path) => existsSync(path)) ?? candidates[0];
}

/** Every location {@link packageTemplatePath} considers, for diagnostics. */
export function packageTemplateCandidates(fileName: string): string[] {
  return [
    join(__dirname, 'templates', fileName),
    join(__dirname, '../templates', fileName),
    join(__dirname, '../src/templates', fileName),
    join(__dirname, '../../src/templates', fileName),
  ];
}
