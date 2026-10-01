/**
 * Locks in the reasoning `vite-initializer.service.ts` gives for skipping a
 * startup static-asset index on the Fastify branch (the Express branch gets
 * one — see `static-asset-index.spec.ts`): `@fastify/static` registers its
 * file lookup as a wildcard *route* (`prefix + '*'`), and Fastify's router
 * (find-my-way) gives an exact/parametric app route registered at the same
 * path priority over that wildcard. So a page route never falls through to
 * the static plugin's file lookup — only paths with no matching route at
 * all do.
 *
 * This uses real `fastify` and `@fastify/static` (no mocks) registered the
 * same way `vite-initializer.service.ts` registers them for the Fastify
 * adapter (see `setupProductionMode`'s `adapterType === 'fastify'` branch),
 * against a real temp directory on disk, and spies on `node:fs`'s `stat`
 * (what `@fastify/send`, which `@fastify/static` uses internally, calls to
 * look up a file) to prove the static plugin's file lookup is never reached
 * for a path a page route also claims.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';

describe('Fastify static plugin vs. page route priority', () => {
  let app: FastifyInstance;
  let dir: string;
  let statSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nestjs-ssr-fastify-static-'));
    // A file that exists on disk at the *same path* a page route also
    // registers below. If the static plugin's wildcard ever won priority
    // for this path, this is the content it would serve instead of the
    // page route's response.
    await writeFile(join(dir, 'duplicate.txt'), 'static-file-content');
    // A real asset with no competing page route, to prove static serving
    // still works for paths the app doesn't own.
    await writeFile(join(dir, 'real-asset.txt'), 'real-asset-content');

    app = Fastify();
    // Same registration `vite-initializer.service.ts` uses for the Fastify
    // adapter in `setupProductionMode` (`@fastify/static` branch):
    // root/prefix/index/maxAge, no other options — i.e. library defaults,
    // including `wildcard: true`.
    await app.register(fastifyStatic, {
      root: dir,
      prefix: '/',
      index: false,
      maxAge: 31536000000,
    });
    // A page route claiming the same path as a real static file.
    app.get('/duplicate.txt', async () => 'page-route-response');

    await app.ready();

    // @fastify/static's file lookup goes through @fastify/send, which calls
    // node:fs's `stat` directly (not fs.promises). Spy without replacing
    // the implementation so real requests still work; only call counts and
    // arguments are observed.
    statSpy = vi.spyOn(fs, 'stat');
  });

  afterEach(async () => {
    statSpy.mockRestore();
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('never reaches the static file lookup for a path a page route also registers', async () => {
    const response = await app.inject({ method: 'GET', url: '/duplicate.txt' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('page-route-response');
    expect(statSpy).not.toHaveBeenCalled();
  });

  it('still serves a real asset from disk when no page route claims its path', async () => {
    const response = await app.inject({ method: 'GET', url: '/real-asset.txt' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('real-asset-content');
    expect(statSpy).toHaveBeenCalled();
  });
});
