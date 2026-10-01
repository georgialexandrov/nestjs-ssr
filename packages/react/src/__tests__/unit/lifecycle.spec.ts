/**
 * Lifecycle of RenderModule inside a real Nest application: what it
 * registers relative to the application's own routes, and what it does to
 * requests in flight when the application shuts down.
 *
 * Runs the built package in a separate Node process: Nest resolves
 * constructor dependencies from decorator metadata, which the build emits
 * and the test transform does not.
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../../..');
const built = existsSync(join(ROOT, 'dist/index.js'));

const APP = String.raw`
const { createRequire } = require('module');
// Resolve Nest the way the package does, and reflect-metadata the way Nest does.
const fromPackage = createRequire(process.env.PACKAGE_ENTRY);
createRequire(fromPackage.resolve('@nestjs/core'))('reflect-metadata');
const { Controller, Get, Module } = fromPackage('@nestjs/common');
const { NestFactory } = fromPackage('@nestjs/core');
const { RenderModule } = fromPackage(process.env.PACKAGE_ENTRY);

let release;
const gate = new Promise((resolve) => (release = resolve));
let entered;
const inHandler = new Promise((resolve) => (entered = resolve));

class AppController {
  async slow() {
    entered();
    await gate;
    return 'done';
  }
  all() {
    return 'route';
  }
}
const method = (name) =>
  Object.getOwnPropertyDescriptor(AppController.prototype, name);
Get('slow')(AppController.prototype, 'slow', method('slow'));
Get('*path')(AppController.prototype, 'all', method('all'));
Controller()(AppController);

const development = process.env.MODE === 'development';

(async () => {
  // Stands in for the external Vite dev server the proxy forwards to.
  const upstream = require('http').createServer((req, res) =>
    res.end('upstream:' + req.url),
  );
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));

  class AppModule {}
  Module({
    imports: [
      RenderModule.forRoot({
        environment: development ? 'development' : 'production',
        vite: { port: upstream.address().port },
      }),
    ],
    controllers: [AppController],
  })(AppModule);

  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const base = 'http://127.0.0.1:' + app.getHttpServer().address().port;
  const text = async (path) => (await fetch(base + path)).text();

  if (development) {
    const result = {
      module: await text('/src/main.ts'),
      route: await text('/recipes'),
    };
    await app.close();
    upstream.close();
    process.stdout.write(JSON.stringify(result));
    return;
  }

  const asset = await text('/assets/app.js');
  const route = await text('/recipes');

  // A request in flight when shutdown begins must still be answered.
  const slow = fetch(base + '/slow').then(
    async (response) => ({ status: response.status, body: await response.text() }),
    (error) => ({ error: String(error.cause?.code ?? error.message) }),
  );
  await inHandler;
  const closing = app.close();
  setTimeout(release, 100);
  const result = { asset, route, slow: await slow };
  await closing;
  upstream.close();
  process.stdout.write(JSON.stringify(result));
})().catch((error) => {
  process.stderr.write(String(error && error.stack));
  process.exit(1);
});
`;

function runApp(mode: 'production' | 'development'): Record<string, unknown> {
  const project = mkdtempSync(join(tmpdir(), 'nestjs-ssr-lifecycle-'));
  try {
    mkdirSync(join(project, 'dist/client/assets'), { recursive: true });
    mkdirSync(join(project, 'src/views'), { recursive: true });
    writeFileSync(
      join(project, 'dist/client/index.html'),
      '<html><body><!--app-html--></body></html>',
    );
    writeFileSync(
      join(project, 'dist/client/assets/app.js'),
      'console.log("asset");',
    );
    writeFileSync(join(project, 'package.json'), '{"name":"lifecycle"}');
    writeFileSync(join(project, 'app.cjs'), APP);
    const output = execFileSync(process.execPath, ['app.cjs'], {
      cwd: project,
      env: {
        ...process.env,
        NODE_ENV: mode,
        MODE: mode,
        PACKAGE_ENTRY: join(ROOT, 'dist/index.js'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    });
    return JSON.parse(output.toString()) as Record<string, unknown>;
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
}

// A catch-all route (`@Get('*path')`) is registered in every app below, as a
// 404 page or an SPA fallback would be.
describe.skipIf(!built)('RenderModule in a running Nest application', () => {
  describe('production', () => {
    let result: Record<string, unknown>;
    beforeAll(() => {
      result = runApp('production');
    }, 60_000);

    it('serves built client assets ahead of the application routes', () => {
      expect(result.asset).toBe('console.log("asset");');
    });

    it('still routes everything else to the application', () => {
      expect(result.route).toBe('route');
    });

    it('lets a request in flight finish when the application shuts down', () => {
      expect(result.slow).toEqual({ status: 200, body: 'done' });
    });
  });

  describe('development', () => {
    let result: Record<string, unknown>;
    beforeAll(() => {
      result = runApp('development');
    }, 60_000);

    it('proxies Vite module requests ahead of the application routes', () => {
      expect(result.module).toBe('upstream:/src/main.ts');
    });

    it('still routes everything else to the application', () => {
      expect(result.route).toBe('route');
    });
  });
});
