import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createServer } from 'node:net';
import { join } from 'path';
import { AppModule } from './app.module';

/**
 * How long to keep waiting for the HTTP port to become free before giving up.
 *
 * `nest start --watch` SIGTERMs the running child and only respawns once that
 * child has emitted 'exit', so in the normal case the port is already free by
 * the time this process runs. The wait covers the cases where it is not: the
 * previous child can still be inside its graceful shutdown (closing the Vite
 * dev server is bounded at 3s by ViteInitializerService), and a shutdown that
 * runs long would otherwise turn a recoverable hiccup into a hard crash.
 * Matching that 3s bound means a legitimately slow shutdown is always waited
 * out, while a port held by something else fails fast enough to notice.
 */
const PORT_WAIT_TIMEOUT_MS = 3000;
const PORT_POLL_INTERVAL_MS = 100;

/**
 * Whether `port` can be bound right now.
 *
 * Probing with a throwaway net server rather than by calling `app.listen()` and
 * catching the rejection is deliberate: NestApplication.listen() logs the
 * failure through its own logger before it rejects, so a retry loop built on it
 * paints the terminal red once per attempt. The probe is silent, which lets the
 * common case (previous child still exiting) recover with no output at all.
 */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}

async function waitForFreePort(port: number): Promise<boolean> {
  const deadline = Date.now() + PORT_WAIT_TIMEOUT_MS;
  for (;;) {
    if (await isPortFree(port)) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, PORT_POLL_INTERVAL_MS));
  }
}

/**
 * Explain a port clash in terms of what actually causes it, instead of letting
 * the EADDRINUSE reject out of bootstrap() unhandled — which on Node 24 prints
 * a raw `node:net` stack dump that says nothing about how to recover.
 *
 * By far the most common cause is a second, orphaned `nest start --watch`.
 * Watch mode outlives its parent shell (closing the terminal, or SIGKILLing
 * `concurrently`, leaves the CLI reparented to init), and every surviving
 * watcher keeps rebuilding on file changes and respawning its own child on the
 * same hardcoded port. One of them wins the port and the app appears to work
 * normally; the losers crash on every single reload.
 */
function reportPortInUse(port: number): void {
  console.error(
    `\nPort ${port} is already in use, so this instance cannot start.\n\n` +
      `The usual cause is another 'nest start --watch' left running from an\n` +
      `earlier session: watch mode survives its parent shell, and every\n` +
      `surviving watcher respawns its own server on this port after each\n` +
      `file change.\n\n` +
      `  Find it:  lsof -nP -iTCP:${port} -sTCP:LISTEN\n` +
      `  Or use another port:  PORT=${port + 1} pnpm dev:nest\n`,
  );
}

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3000);

  // Checked before the app is created so a clash costs nothing: creating the
  // Nest app also spins up the SSR Vite server, and tearing that back down
  // after a failed listen() is both slow and another chance to leak handles.
  if (!(await waitForFreePort(port))) {
    reportPortInUse(port);
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable graceful shutdown - ensures Vite server closes properly
  app.enableShutdownHooks();

  // Serve static assets in production
  if (process.env.NODE_ENV === 'production') {
    app.useStaticAssets(join(process.cwd(), 'dist/client'), {
      index: false,
      maxAge: '1y',
    });
  }

  try {
    await app.listen(port);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
    // Lost the race in the gap between the probe closing its socket and
    // listen() binding it. Two watchers rebuilding off the same file change
    // reach this point within the same millisecond, so the probe cannot rule
    // it out - only report it well.
    //
    // Deliberately no `await app.close()` first: the Vite dev server created
    // moments ago is still running its dependency scan, and closing it
    // mid-scan makes Vite print its own multi-frame "server is being
    // restarted or closed" stack - trading one ugly trace for another. The
    // process is about to die and the OS reclaims the port, the ephemeral HMR
    // socket and every other handle regardless.
    reportPortInUse(port);
    process.exit(1);
  }

  console.log(`Application running on http://localhost:${port}`);
}

// Without this, any rejection from bootstrap() is an unhandled rejection, which
// Node 24 reports by dumping the raw internal stack and killing the process.
bootstrap().catch((error: unknown) => {
  console.error(
    `\nFailed to start the application: ${
      error instanceof Error ? error.message : String(error)
    }\n`,
  );
  process.exit(1);
});
