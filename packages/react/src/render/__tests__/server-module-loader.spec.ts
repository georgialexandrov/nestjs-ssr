import { join } from 'path';
import { resolveServerEntryFromManifest } from '../server-module-loader';

describe('resolveServerEntryFromManifest', () => {
  const distDir = '/app/dist/server';

  it('finds the .mjs entry Vite emits for a CommonJS project', () => {
    const manifest = {
      'src/views/entry-server.tsx': {
        file: 'entry-server.mjs',
        isEntry: true,
      },
    };
    expect(resolveServerEntryFromManifest(manifest, distDir)).toBe(
      join(distDir, 'entry-server.mjs'),
    );
  });

  // Nest 12's `nest new` creates "type": "module" projects, where Vite emits
  // a .js entry. The root layout lookup once assumed .mjs and silently
  // rendered every page without its root layout in production.
  it('finds the .js entry Vite emits for an ES module project', () => {
    const manifest = {
      'src/views/entry-server.tsx': {
        file: 'entry-server.js',
        isEntry: true,
      },
    };
    expect(resolveServerEntryFromManifest(manifest, distDir)).toBe(
      join(distDir, 'entry-server.js'),
    );
  });

  it('ignores non-entry chunks and reports a missing entry as null', () => {
    const manifest = {
      'src/views/entry-server.tsx': { file: 'chunk-abc.js', isEntry: false },
    };
    expect(resolveServerEntryFromManifest(manifest, distDir)).toBeNull();
    expect(resolveServerEntryFromManifest(null, distDir)).toBeNull();
  });
});
