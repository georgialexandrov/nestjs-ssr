/**
 * `nestjs-ssr dev`: run the NestJS side of development without restarting on
 * view edits.
 *
 * `nest start --watch` restarts the application after every successful
 * compile. Controllers import their views for `@Render(Component)`, so every
 * `.tsx` edit recompiles and restarts Nest: state is lost, connections drop,
 * and an edit costs a full boot instead of a hot update.
 *
 * This runner compiles with `nest build --watch` and starts the compiled
 * application itself. After each compile it compares the content of every
 * emitted file with what the running process was started from, and restarts
 * only when something outside a `views` directory changed. View changes are
 * picked up without a restart: the process is started with
 * NESTJS_SSR_FRESH_VIEWS=1, which makes the render service load views
 * through Vite in development, and the browser receives the edit through
 * Vite HMR as usual.
 */
import { spawn, type ChildProcess } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync, watch } from 'fs';
import { createRequire } from 'module';
import { join, relative, sep } from 'path';

const DEBOUNCE_MS = 150;

interface DevOptions {
  cwd: string;
  /** Extra arguments passed through to `nest build --watch`. */
  buildArgs: string[];
  log: (message: string) => void;
}

/** Output files that describe a compile, not code the process runs. */
function isRuntimeOutput(file: string): boolean {
  return (
    /\.(c|m)?js$/.test(file) &&
    !file.endsWith('.d.ts') &&
    !file.endsWith('.map')
  );
}

/** A compiled view: anything inside a `views` directory. */
export function isViewOutput(file: string): boolean {
  return file.split(/[\\/]/).includes('views');
}

function hashFile(path: string): string | undefined {
  try {
    return createHash('sha1').update(readFileSync(path)).digest('hex');
  } catch {
    return undefined;
  }
}

function listOutputs(dir: string, root = dir, out = new Map<string, string>()) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'client' || entry === 'server' || entry === 'node_modules')
        continue; // Vite bundles, not Nest output
      listOutputs(path, root, out);
    } else if (isRuntimeOutput(entry)) {
      const hash = hashFile(path);
      if (hash) out.set(relative(root, path), hash);
    }
  }
  return out;
}

/**
 * Decide whether a set of changed outputs requires restarting Nest.
 * Exported for tests.
 */
export function needsRestart(
  before: Map<string, string>,
  after: Map<string, string>,
): { restart: boolean; changed: string[] } {
  const changed: string[] = [];
  for (const [file, hash] of after) {
    if (before.get(file) !== hash) changed.push(file);
  }
  for (const file of before.keys()) {
    if (!after.has(file)) changed.push(file);
  }
  return {
    restart: changed.some((file) => !isViewOutput(file)),
    changed,
  };
}

function resolveNestBin(cwd: string): string {
  const require = createRequire(join(cwd, 'package.json'));
  return require.resolve('@nestjs/cli/bin/nest.js');
}

function readOutDir(cwd: string): string {
  for (const file of ['tsconfig.build.json', 'tsconfig.json']) {
    try {
      const raw = readFileSync(join(cwd, file), 'utf-8');
      const match = /"outDir"\s*:\s*"([^"]+)"/.exec(raw);
      if (match) return join(cwd, match[1]);
    } catch {
      // try the next config
    }
  }
  return join(cwd, 'dist');
}

function compiledMain(outDir: string): string | undefined {
  return ['main.js', join('src', 'main.js')]
    .map((file) => join(outDir, file))
    .find((path) => existsSync(path));
}

export function runDev(options: DevOptions): void {
  const { cwd, log } = options;
  const outDir = readOutDir(cwd);
  let app: ChildProcess | undefined;
  let running = new Map<string, string>();
  let timer: NodeJS.Timeout | undefined;
  let stopping = false;

  const startApp = () => {
    const main = compiledMain(outDir);
    if (!main) return;
    running = listOutputs(outDir);
    app = spawn(process.execPath, ['--enable-source-maps', main], {
      cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV ?? 'development',
        NESTJS_SSR_FRESH_VIEWS: '1',
      },
    });
  };

  const stopApp = (): Promise<void> =>
    new Promise((resolve) => {
      if (!app || app.exitCode !== null) return resolve();
      app.once('exit', () => resolve());
      app.kill('SIGTERM');
    });

  const onOutputChanged = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void (async () => {
        if (stopping) return;
        if (!app) {
          startApp();
          return;
        }
        const next = listOutputs(outDir);
        const { restart, changed } = needsRestart(running, next);
        if (changed.length === 0) return;
        if (!restart) {
          running = next;
          log(
            `View updated without restarting Nest: ${changed.map((f) => f.split(sep).join('/')).join(', ')}`,
          );
          return;
        }
        log('Restarting Nest...');
        await stopApp();
        startApp();
      })();
    }, DEBOUNCE_MS);
  };

  const build = spawn(
    process.execPath,
    [
      resolveNestBin(cwd),
      'build',
      '--watch',
      '--preserveWatchOutput',
      ...options.buildArgs,
    ],
    { cwd, stdio: 'inherit', env: process.env },
  );

  // `nest build` deletes and recreates the output directory on its first
  // compile, and a watcher on a deleted directory can go silent. Re-attach
  // whenever the directory appears or is replaced.
  let watcher: ReturnType<typeof watch> | undefined;
  let watchedInode: number | undefined;
  const ensureWatcher = () => {
    let inode: number | undefined;
    try {
      inode = statSync(outDir).ino;
    } catch {
      inode = undefined;
    }
    if (inode === watchedInode) return;
    watcher?.close();
    watcher = undefined;
    watchedInode = inode;
    if (inode === undefined) return;
    watcher = watch(outDir, { recursive: true }, onOutputChanged);
    watcher.on('error', () => {
      watcher?.close();
      watcher = undefined;
      watchedInode = undefined;
    });
    onOutputChanged();
  };
  const reattach = setInterval(ensureWatcher, 500);
  ensureWatcher();

  const shutdown = () => {
    stopping = true;
    clearInterval(reattach);
    watcher?.close();
    build.kill('SIGTERM');
    void stopApp().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  build.on('exit', (code) => {
    if (!stopping) {
      stopping = true;
      clearInterval(reattach);
      watcher?.close();
      void stopApp().then(() => process.exit(code ?? 1));
    }
  });
}
