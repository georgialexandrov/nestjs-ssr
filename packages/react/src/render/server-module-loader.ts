import type { ViteDevServer } from 'vite';
import { join } from 'path';
import type {
  AnyComponent,
  RenderPayload,
} from '../interfaces/component.interface';

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
  serverDistDir: string;
  isDevelopment: boolean;
  /** Maximum duration of one SSR render in milliseconds */
  timeoutMs?: number;
  /** CSP nonce for injected script tags, when the app provides one */
  nonce?: string;
  /** Dev client entry URL path relative to the Vite root */
  entryClientDev: string;
}

/**
 * The entry-server module shape produced by the user's entry-server.tsx
 */
export interface ServerEntryModule {
  renderComponent: (
    component: AnyComponent,
    data: RenderPayload,
  ) => Promise<string> | string;
  renderSegment: (
    component: AnyComponent,
    data: RenderPayload,
  ) => Promise<string> | string;
  renderComponentStream: (
    component: AnyComponent,
    data: RenderPayload,
    options?: {
      nonce?: string;
      onShellReady?: () => void;
      onShellError?: (error: unknown) => void;
      onError?: (error: unknown) => void;
      onAllReady?: () => void;
    },
  ) => {
    pipe: (destination: NodeJS.WritableStream) => void;
    abort: () => void;
  };
  getRootLayout?: () => AnyComponent | null | undefined;
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
  context: Pick<
    RendererContext,
    'vite' | 'serverManifest' | 'entryServerPath' | 'serverDistDir'
  >,
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

  const serverPath = join(context.serverDistDir, manifestEntry[1].file);
  return (await import(serverPath)) as ServerEntryModule;
}
