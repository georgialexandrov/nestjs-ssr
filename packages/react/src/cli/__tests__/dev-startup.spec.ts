/**
 * @vitest-environment node
 *
 * `nestjs-ssr dev` started after a `pnpm build`, against a stand-in for
 * `nest build --watch` that rewrites the stale output with identical
 * content. The runner must start the application from the fresh output, not
 * from the stale directory it found at launch.
 */
import { afterEach, beforeEach, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const DEV = join(__dirname, '../dev.ts');

// Records each start, then needs a sibling module, like a compiled main.ts.
const MAIN = `
require('fs').appendFileSync(require('path').join(__dirname, '../starts.log'), Date.now() + '\\n');
require('./app.module.js');
setInterval(() => {}, 1000);
`;

/**
 * @param deleteOutDir delete the directory first, as `nest new` projects do
 * @param done the compiler's completion line: tsc prints it on stdout, swc
 * on stderr
 */
const fakeNest = (deleteOutDir: boolean, done: string) => `
const fs = require('fs');
const path = require('path');
const dist = path.join(process.cwd(), 'dist');
setTimeout(() => {
  if (${deleteOutDir}) fs.rmSync(dist, { recursive: true, force: true });
  setTimeout(() => {
    fs.mkdirSync(dist, { recursive: true });
    fs.writeFileSync(path.join(dist, 'main.js'), ${JSON.stringify(MAIN)});
    fs.writeFileSync(path.join(dist, 'app.module.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(process.cwd(), 'fresh-at'), String(Date.now()));
    ${done};
  }, 1000);
}, 300);
setInterval(() => {}, 1000);
`;

let project: string;
let runner: ChildProcess | undefined;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'dev-startup-'));
  writeFileSync(join(project, 'package.json'), '{}');
  mkdirSync(join(project, 'node_modules/@nestjs/cli/bin'), { recursive: true });
  writeFileSync(
    join(project, 'node_modules/@nestjs/cli/package.json'),
    '{"name":"@nestjs/cli"}',
  );
  // The complete output of an earlier build.
  mkdirSync(join(project, 'dist'));
  writeFileSync(join(project, 'dist/main.js'), MAIN);
  writeFileSync(join(project, 'dist/app.module.js'), 'module.exports = {};');
});

afterEach(() => {
  runner?.kill('SIGTERM');
  rmSync(project, { recursive: true, force: true });
});

it.each([
  [
    'tsc, deleteOutDir',
    true,
    "console.log('Found 0 errors. Watching for file changes.')",
  ],
  [
    'swc, rewritten in place',
    false,
    "console.error('Successfully compiled: 2 files with swc')",
  ],
])(
  '%s: starts from the fresh compile',
  async (_, deleteOutDir, done) => {
    writeFileSync(
      join(project, 'node_modules/@nestjs/cli/bin/nest.js'),
      fakeNest(deleteOutDir, done),
    );
    runner = spawn(
      process.execPath,
      [
        '--import',
        'tsx',
        '-e',
        `import(${JSON.stringify(DEV)}).then((m) => m.runDev({ cwd: ${JSON.stringify(project)}, buildArgs: [], log: () => {} }))`,
      ],
      { cwd: __dirname, stdio: 'ignore' },
    );

    const startedAfterCompile = () => {
      const starts = join(project, 'starts.log');
      const freshAt = join(project, 'fresh-at');
      if (!existsSync(starts) || !existsSync(freshAt)) return false;
      const compiled = Number(readFileSync(freshAt, 'utf-8'));
      return readFileSync(starts, 'utf-8')
        .trim()
        .split('\n')
        .some((line) => Number(line) >= compiled);
    };

    const deadline = Date.now() + 8000;
    while (!startedAfterCompile() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(startedAfterCompile()).toBe(true);
  },
  15_000,
);
