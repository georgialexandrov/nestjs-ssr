import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildStaticAssetIndex,
  requestPathname,
  skipUnlistedPaths,
} from '../static-asset-index';

describe('buildStaticAssetIndex', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  async function makeBuildDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'nestjs-ssr-static-'));
    dirs.push(dir);
    return dir;
  }

  it('indexes every file recursively as a leading-slash, POSIX-style path', async () => {
    const dir = await makeBuildDir();
    await writeFile(join(dir, 'index.html'), '<html></html>');
    await mkdir(join(dir, 'assets'), { recursive: true });
    await writeFile(join(dir, 'assets', 'app-abc123.js'), 'console.log(1)');
    await mkdir(join(dir, 'assets', 'nested'), { recursive: true });
    await writeFile(join(dir, 'assets', 'nested', 'chunk.js'), '// chunk');

    const index = await buildStaticAssetIndex(dir);

    expect(index).not.toBeNull();
    expect([...index!].sort()).toEqual([
      '/assets/app-abc123.js',
      '/assets/nested/chunk.js',
      '/index.html',
    ]);
  });

  it('does not index directories themselves', async () => {
    const dir = await makeBuildDir();
    await mkdir(join(dir, 'assets'), { recursive: true });
    await writeFile(join(dir, 'assets', 'a.js'), '');

    const index = await buildStaticAssetIndex(dir);

    expect(index!.has('/assets')).toBe(false);
    expect(index!.has('/assets/a.js')).toBe(true);
  });

  it('returns null when the directory cannot be listed', async () => {
    const index = await buildStaticAssetIndex(
      '/definitely/not/a/real/dist/client/dir',
    );
    expect(index).toBeNull();
  });
});

describe('requestPathname', () => {
  it('strips the query string', () => {
    expect(requestPathname('/assets/a.js?v=2')).toBe('/assets/a.js');
  });

  it('percent-decodes the path', () => {
    expect(requestPathname('/assets/a%20b.js')).toBe('/assets/a b.js');
  });

  it('returns undefined for an empty or missing url', () => {
    expect(requestPathname(undefined)).toBeUndefined();
    expect(requestPathname('')).toBeUndefined();
  });
});

describe('skipUnlistedPaths', () => {
  it('never invokes the wrapped handler for a path outside the index', () => {
    const handler = vi.fn();
    const index = new Set(['/assets/a.js']);
    const wrapped = skipUnlistedPaths(handler, index);
    const next = vi.fn();

    wrapped({ url: '/some/page/route' }, {}, next);

    expect(handler).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('invokes the wrapped handler for a path recorded in the index', () => {
    const handler = vi.fn();
    const index = new Set(['/assets/a.js']);
    const wrapped = skipUnlistedPaths(handler, index);
    const next = vi.fn();
    const req = { url: '/assets/a.js' };
    const res = {};

    wrapped(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
  });

  it('matches an indexed path ignoring the query string', () => {
    const handler = vi.fn();
    const index = new Set(['/assets/a.js']);
    const wrapped = skipUnlistedPaths(handler, index);
    const next = vi.fn();
    const req = { url: '/assets/a.js?v=123' };

    wrapped(req, {}, next);

    expect(handler).toHaveBeenCalled();
  });
});
