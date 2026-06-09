import type { ViteDevServer } from 'vite';

export interface ViteManifest {
  [key: string]: {
    file: string;
    src?: string;
    isEntry?: boolean;
    imports?: string[];
    css?: string[];
  };
}

/**
 * Everything a renderer needs to produce HTML, assembled once per request
 * by RenderService and shared by both rendering modes.
 */
export interface RendererContext {
  template: string;
  vite: ViteDevServer | null;
  manifest: ViteManifest | null;
  serverManifest: ViteManifest | null;
  entryServerPath: string;
  isDevelopment: boolean;
  /** CSP nonce for injected script tags, when the app provides one */
  nonce?: string;
}

/**
 * The entry-server module shape produced by the user's entry-server.tsx
 */
export interface ServerEntryModule {
  renderComponent: (component: any, data: any) => Promise<string> | string;
  renderSegment: (component: any, data: any) => Promise<string> | string;
  renderComponentStream: (
    component: any,
    data: any,
    callbacks?: Record<string, (...args: any[]) => void>,
  ) => { pipe: (destination: any) => void; abort: () => void };
  getRootLayout?: () => any;
}

const SERVER_BUNDLE_ERROR =
  'Server bundle not found in manifest. Run `pnpm build:server` to generate the server bundle.';

/**
 * Load the entry-server module.
 *
 * Development: through Vite's SSR module loader (HMR-aware).
 * Production: from the built server bundle, resolved via the Vite manifest.
 */
export async function loadServerModule(
  context: Pick<RendererContext, 'vite' | 'serverManifest' | 'entryServerPath'>,
): Promise<ServerEntryModule> {
  if (context.vite) {
    return (await context.vite.ssrLoadModule(
      context.entryServerPath,
    )) as ServerEntryModule;
  }

  const manifestEntry = Object.entries(context.serverManifest ?? {}).find(
    ([key, value]) => value.isEntry && key.includes('entry-server'),
  );

  if (!manifestEntry) {
    throw new Error(SERVER_BUNDLE_ERROR);
  }

  const serverPath = `${process.cwd()}/dist/server/${manifestEntry[1].file}`;
  return (await import(serverPath)) as ServerEntryModule;
}
