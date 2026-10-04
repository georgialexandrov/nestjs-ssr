import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  loadServerModule,
  resolveServerEntryFromManifest,
} from '../server-module-loader';

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

describe('loadServerModule in production', () => {
  // Inside the package: vitest's module runner only imports from the project.
  const created: string[] = [];
  afterAll(() => {
    for (const dir of created) rmSync(dir, { recursive: true, force: true });
  });

  function bundle(file: string) {
    const dir = mkdtempSync(join(__dirname, '.tmp-bundle-'));
    created.push(dir);
    writeFileSync(
      join(dir, file),
      'export const renderComponent = () => "ok";',
    );
    return {
      vite: null,
      serverDistDir: dir,
      entryServerPath: '',
      serverManifest: {
        'src/views/entry-server.tsx': { file, isEntry: true },
      },
    };
  }

  it('loads the bundle once per manifest and reuses it', async () => {
    const context = bundle('entry-server.mjs');
    const first = await loadServerModule(context);
    const second = await loadServerModule(context);
    expect(second).toBe(first);
    expect(typeof first.renderComponent).toBe('function');
  });

  it('does not reuse a module across different bundle directories', async () => {
    const context = bundle('entry-server.mjs');
    const first = await loadServerModule(context);
    const other = bundle('entry-server.mjs');
    const second = await loadServerModule({
      ...other,
      serverManifest: context.serverManifest,
    });
    expect(second).not.toBe(first);
  });

  it('retries after a failed load instead of caching the failure', async () => {
    const context = bundle('entry-server.mjs');
    const missing = {
      ...context,
      serverDistDir: join(context.serverDistDir, 'nope'),
    };
    await expect(loadServerModule(missing)).rejects.toThrow();
    await expect(loadServerModule(context)).resolves.toBeDefined();
  });
});
