import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/**
 * Recursively lists every file under `dir` once, into a `Set` of URL-style
 * paths (POSIX separators, leading `/`, relative to `dir`).
 *
 * The production client build directory is immutable while the process
 * runs — Vite writes it once per build, before the server starts serving —
 * so building this index at startup and keeping it in memory for the
 * process lifetime is safe. A file added to (or removed from) the directory
 * after the server has started is not reflected until restart; that is an
 * explicit, documented property of this index, not an oversight.
 *
 * Returns `null` when the directory can't be listed (missing, permissions,
 * or any other error): callers should fall back to always invoking the
 * static handler rather than treating every request as a guaranteed miss.
 */
export async function buildStaticAssetIndex(
  dir: string,
): Promise<Set<string> | null> {
  try {
    const entries = await fs.readdir(dir, {
      recursive: true,
      withFileTypes: true,
    });
    const index = new Set<string>();
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const parentDir =
        (entry as { parentPath?: string; path?: string }).parentPath ??
        (entry as { path?: string }).path ??
        dir;
      const absolute = path.join(parentDir, entry.name);
      const relative = path
        .relative(dir, absolute)
        .split(path.sep)
        .join('/');
      index.add(`/${relative}`);
    }
    return index;
  } catch {
    return null;
  }
}

/**
 * The pathname a static-file handler keys its lookup on: the request URL
 * without the query string, percent-decoded the same way `express.static`
 * (via `send`) decodes it before touching the filesystem.
 */
export function requestPathname(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const queryIndex = url.indexOf('?');
  const withoutQuery = queryIndex === -1 ? url : url.slice(0, queryIndex);
  try {
    return decodeURIComponent(withoutQuery);
  } catch {
    // A malformed percent-escape: let the wrapped handler's own decoding
    // (and error handling) see the raw value rather than guessing here.
    return withoutQuery;
  }
}

/** Minimal request/response/middleware shape this wrapper needs. */
type StaticMiddleware = (
  req: { url?: string },
  res: unknown,
  next: () => void,
) => unknown;

/**
 * Wrap a static-file handler so it only runs for a path recorded in the
 * startup index. Any other path calls `next()` directly — skipping the
 * handler's own filesystem check (e.g. `express.static`'s `fs.stat`)
 * entirely, which is the whole point for the page routes that make up most
 * production traffic and never match a build asset.
 */
export function skipUnlistedPaths<T extends StaticMiddleware>(
  handler: T,
  index: Set<string>,
): T {
  const wrapped: StaticMiddleware = (req, res, next) => {
    const pathname = requestPathname(req?.url);
    if (pathname === undefined || !index.has(pathname)) {
      next();
      return;
    }
    handler(req, res, next);
  };
  return wrapped as T;
}
