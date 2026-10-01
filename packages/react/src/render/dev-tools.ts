/**
 * Loads the development-only tooling (`./dev`): the Vite dev server and
 * proxy, the error page's source-mapped diagnostics and fresh view loading.
 *
 * It is a separate chunk that a production server never imports, which keeps
 * it out of production memory and startup. Development loads it once, during
 * module initialization, before the first request.
 */
type DevTools = typeof import('./dev');

let devTools: DevTools | undefined;
let loading: Promise<DevTools> | undefined;

export function loadDevTools(): Promise<DevTools> {
  loading ??= import('./dev').then((module) => (devTools = module));
  return loading;
}

/** The development tooling if it has been loaded, for synchronous callers. */
export function loadedDevTools(): DevTools | undefined {
  return devTools;
}
