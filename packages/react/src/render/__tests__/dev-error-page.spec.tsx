import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildDevErrorDetails,
  readCodeFrame,
  resolveFrames,
} from '../error-pages/dev-error-details';
import { ErrorPageDevelopment, ErrorPageProduction } from '../error-pages';

describe('development error details', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'dev-error-'));
    mkdirSync(join(root, 'src/views'), { recursive: true });
    writeFileSync(
      join(root, 'src/views/recipe-list.tsx'),
      [
        'export default function RecipeList() {',
        '  const recipes = load();',
        '  return recipes.map((r) => r.name);',
        '}',
      ].join('\n'),
    );
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function errorAt(file: string, line: number, column: number) {
    const error = new TypeError(
      "Cannot read properties of undefined (reading 'map')",
    );
    error.stack = [
      `TypeError: ${error.message}`,
      `    at RecipeList (${file}:${line}:${column})`,
      `    at renderWithHooks (${join(root, 'node_modules/react-dom/cjs/server.js')}:10:5)`,
      '    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)',
    ].join('\n');
    return error;
  }

  it('separates application frames from dependencies and Node internals', () => {
    const error = errorAt(join(root, 'src/views/recipe-list.tsx'), 3, 18);
    const frames = resolveFrames(error.stack!, root);
    expect(frames.map((f) => [f.fn, f.displayPath, f.isProject])).toEqual([
      ['RecipeList', join('src', 'views', 'recipe-list.tsx'), true],
      [
        'renderWithHooks',
        join('node_modules', 'react-dom', 'cjs', 'server.js'),
        false,
      ],
      [
        'process.processTicksAndRejections',
        'node:internal/process/task_queues',
        false,
      ],
    ]);
  });

  it('shows the source lines around the failing line', () => {
    const [frame] = resolveFrames(
      errorAt(join(root, 'src/views/recipe-list.tsx'), 3, 18).stack!,
      root,
    );
    const code = readCodeFrame(frame, 1)!;
    expect(code.line).toBe(3);
    expect(code.lines.map((l) => l.number)).toEqual([2, 3, 4]);
    expect(code.lines[1].text).toContain('recipes.map');
  });

  it('maps compiled output back to source through its .map file', () => {
    // A tsc-emitted file whose line 2 comes from line 3 of the source.
    mkdirSync(join(root, 'dist/views'), { recursive: true });
    writeFileSync(join(root, 'dist/views/recipe-list.js'), 'a\nb\n');
    writeFileSync(
      join(root, 'dist/views/recipe-list.js.map'),
      JSON.stringify({
        version: 3,
        file: 'recipe-list.js',
        sources: ['../../src/views/recipe-list.tsx'],
        names: [],
        mappings: 'AAAA;AAEA',
      }),
    );
    const [frame] = resolveFrames(
      errorAt(join(root, 'dist/views/recipe-list.js'), 2, 1).stack!,
      root,
    );
    expect(frame.displayPath).toBe(join('src', 'views', 'recipe-list.tsx'));
    expect(frame.line).toBe(3);
  });

  it('builds details with the request and an editor link, and never throws', () => {
    const error = errorAt(join(root, 'src/views/recipe-list.tsx'), 3, 18);
    const details = buildDevErrorDetails(error, {
      root,
      vitePort: 5173,
      request: { method: 'GET', url: '/recipes' },
    });
    expect(details.codeFrame?.line).toBe(3);
    expect(details.openInEditorBase).toBe(
      'http://localhost:5173/__open-in-editor?file=',
    );
    const broken = new Error('no stack');
    broken.stack = undefined;
    expect(() => buildDevErrorDetails(broken, { root })).not.toThrow();
  });
});

describe('ErrorPageDevelopment', () => {
  it('renders from the original three props alone', () => {
    const html = renderToStaticMarkup(
      <ErrorPageDevelopment
        error={new Error('boom')}
        viewPath="views/home"
        phase="shell"
      />,
    );
    expect(html).toContain('boom');
    expect(html).toContain('views/home');
  });

  it('escapes the error message and applies the nonce', () => {
    const html = renderToStaticMarkup(
      <ErrorPageDevelopment
        error={new Error('<script>alert(1)</script>')}
        viewPath="views/home"
        phase="shell"
        nonce="abc"
      />,
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('nonce="abc"');
  });
});

describe('ErrorPageProduction', () => {
  it('reveals nothing about the error', () => {
    const html = renderToStaticMarkup(<ErrorPageProduction />);
    expect(html).not.toMatch(/stack|recipe-list|TypeError|node_modules/i);
  });
});
