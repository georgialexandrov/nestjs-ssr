import {
  HttpException,
  Injectable,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ViteDevServer } from 'vite';
import type {
  SSRMode,
  HeadData,
  SegmentResponse,
  SSRResponse,
} from '../interfaces';
import type { NestSsrProjectPaths } from '../config/nest-project-paths.interface';
import { SSR_PROJECT_PATHS } from '../config/nest-project-resolver';
import { StringRenderer } from './renderers/string-renderer';
import { StreamRenderer } from './renderers/stream-renderer';
import {
  resolveServerEntryFromManifest,
  type RendererContext,
  type ServerEntryModule,
  type ViteManifest,
} from './server-module-loader';
import { isDevelopmentEnv, warnIfNodeEnvUnset } from './environment.util';
import { getErrorMessage } from './error.util';
import { getComponentName } from './component-name.util';
import { packageTemplateCandidates } from './package-paths';
import type { FreshViews } from './dev/fresh-views';
import { loadedDevTools } from './dev-tools';
import {
  StreamingErrorHandler,
  type DevErrorContext,
} from './streaming-error-handler';
import { RenderDeadlineError } from './pipeline/errors';
import { PublicPayloadProjector } from './pipeline/public-payload';
import type {
  SerializationLimits,
  SerializationTarget,
} from './pipeline/safe-serialize';
import type {
  AnyComponent,
  RenderPayload,
  ViewModule,
} from '../interfaces/component.interface';

/**
 * Main render service that orchestrates SSR rendering
 *
 * This service:
 * - Loads and manages HTML templates
 * - Handles Vite manifest loading for production
 * - Discovers root layouts
 * - Delegates rendering to StringRenderer (default) or StreamRenderer
 *
 * String mode is the default because it provides:
 * - Atomic responses (complete HTML or error page)
 * - Proper HTTP status codes always
 * - Simpler error handling and debugging
 *
 * Stream mode is available for advanced use cases requiring:
 * - Better TTFB (Time to First Byte)
 * - Progressive rendering with Suspense support
 */
@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);
  private vite: ViteDevServer | null = null;
  private template: string;
  private manifest: ViteManifest | null = null;
  private viewIndex: Record<string, string[]> | null = null;
  private serverManifest: ViteManifest | null = null;
  private isDevelopment: boolean;
  private ssrMode: SSRMode;
  private readonly entryServerPath: string;
  private rootLayout: AnyComponent | null | undefined = undefined;
  private rootLayoutChecked = false;
  private rootLayoutDevPath: string | null = null;
  private readonly timeoutMs: number;

  constructor(
    private readonly stringRenderer: StringRenderer,
    private readonly streamRenderer: StreamRenderer,
    @Inject(SSR_PROJECT_PATHS)
    private readonly projectPaths: NestSsrProjectPaths,
    @Optional() @Inject('SSR_MODE') ssrMode?: SSRMode,
    @Optional() @Inject('DEFAULT_HEAD') private readonly defaultHead?: HeadData,
    @Optional() @Inject('CUSTOM_TEMPLATE') customTemplate?: string,
    @Optional() @Inject('SSR_TIMEOUT') timeoutMs?: number,
    @Optional()
    private readonly errorHandler?: StreamingErrorHandler,
    @Optional()
    @Inject('SHOW_ERROR_PAGE')
    private readonly showErrorPage = false,
    @Optional()
    private readonly payloadProjector: PublicPayloadProjector = new PublicPayloadProjector(),
  ) {
    this.isDevelopment = isDevelopmentEnv();
    warnIfNodeEnvUnset(this.logger);

    // Default to 'string' mode - simpler, atomic responses, proper HTTP status codes
    this.ssrMode = ssrMode || (process.env.SSR_MODE as SSRMode) || 'string';
    this.timeoutMs =
      typeof timeoutMs === 'number' &&
      Number.isFinite(timeoutMs) &&
      timeoutMs > 0
        ? timeoutMs
        : 10_000;

    this.entryServerPath = this.projectPaths.entryServerDev;

    // Load HTML template
    this.template = this.loadTemplate(customTemplate);

    // In production, load the Vite manifests
    if (!this.isDevelopment) {
      this.loadManifests();
    }
  }

  /**
   * Load HTML template from custom path, package, or local location
   */
  private loadTemplate(customTemplate?: string): string {
    if (customTemplate) {
      return this.loadCustomTemplate(customTemplate);
    }
    return this.loadDefaultTemplate();
  }

  private loadCustomTemplate(customTemplate: string): string {
    if (
      customTemplate.includes('<!DOCTYPE') ||
      customTemplate.includes('<html')
    ) {
      this.logger.log(`✓ Loaded custom template (inline)`);
      return customTemplate;
    }

    const customTemplatePath = customTemplate.startsWith('/')
      ? customTemplate
      : join(this.projectPaths.workspaceRoot, customTemplate);

    if (!existsSync(customTemplatePath)) {
      throw new Error(
        `Custom template file not found at ${customTemplatePath}`,
      );
    }

    try {
      const template = readFileSync(customTemplatePath, 'utf-8');
      this.logger.log(`✓ Loaded custom template from ${customTemplatePath}`);
      return template;
    } catch (error) {
      throw new Error(
        `Failed to read custom template file at ${customTemplatePath}: ${getErrorMessage(error)}`,
        { cause: error },
      );
    }
  }

  private loadDefaultTemplate(): string {
    let templatePath: string;

    if (this.isDevelopment) {
      const packageTemplatePaths = packageTemplateCandidates('index.html');
      const localTemplatePath = this.projectPaths.templateDev;

      const foundPackageTemplate = packageTemplatePaths.find((p) =>
        existsSync(p),
      );

      if (foundPackageTemplate) {
        templatePath = foundPackageTemplate;
      } else if (existsSync(localTemplatePath)) {
        templatePath = localTemplatePath;
      } else {
        throw new Error(
          `Template file not found. Tried:\n` +
            packageTemplatePaths
              .map((p) => `  - ${p} (package template)`)
              .join('\n') +
            `\n` +
            `  - ${localTemplatePath} (local template)`,
        );
      }
    } else {
      templatePath = join(this.projectPaths.clientDistDir, 'index.html');

      if (!existsSync(templatePath)) {
        throw new Error(
          `Template file not found at ${templatePath}. ` +
            `Make sure to run the build process first.`,
        );
      }
    }

    try {
      const template = readFileSync(templatePath, 'utf-8');
      this.logger.log(`✓ Loaded template from ${templatePath}`);
      return template;
    } catch (error) {
      throw new Error(
        `Failed to read template file at ${templatePath}: ${getErrorMessage(error)}`,
        { cause: error },
      );
    }
  }

  private loadManifests(): void {
    const manifestPath = join(
      this.projectPaths.clientDistDir,
      '.vite/manifest.json',
    );
    if (existsSync(manifestPath)) {
      this.manifest = JSON.parse(
        readFileSync(manifestPath, 'utf-8'),
      ) as ViteManifest;
    } else {
      this.logger.warn(
        '⚠️  Client manifest not found. Run `pnpm build:client` first.',
      );
    }

    // Written by the nestjsSsr() Vite plugin; lets route preloads find a
    // view by component name. Optional: without it, the naming convention.
    const viewIndexPath = join(
      this.projectPaths.clientDistDir,
      '.vite/nestjs-ssr-views.json',
    );
    // Only an optimization, so a missing or unreadable index is not an error.
    try {
      this.viewIndex = JSON.parse(
        readFileSync(viewIndexPath, 'utf-8'),
      ) as Record<string, string[]>;
    } catch {
      this.viewIndex = null;
    }

    const serverManifestPath = join(
      this.projectPaths.serverDistDir,
      '.vite/manifest.json',
    );
    if (existsSync(serverManifestPath)) {
      this.serverManifest = JSON.parse(
        readFileSync(serverManifestPath, 'utf-8'),
      ) as ViteManifest;
    } else {
      this.logger.warn(
        '⚠️  Server manifest not found. Run `pnpm build:server` first.',
      );
    }
  }

  setViteServer(vite: ViteDevServer) {
    this.vite = vite;
  }

  /**
   * Get the root layout component if it exists
   * Auto-discovers layout files at conventional paths:
   * - src/views/layout.tsx
   * - src/views/layout/index.tsx
   * - src/views/_layout.tsx
   *
   * In development the layout is re-loaded through Vite on every call so
   * edits to the layout file are picked up (Vite caches unchanged modules,
   * so this is cheap). Once a layout file is found its path is cached;
   * filesystem probing only repeats while none exists, so a layout created
   * after startup is still discovered. In production the resolved layout
   * is cached forever.
   */
  async getRootLayout(): Promise<AnyComponent | null> {
    if (this.rootLayoutChecked && !this.vite) {
      return this.rootLayout ?? null;
    }

    try {
      // In development, use Vite's SSR module loader
      if (this.vite) {
        if (!this.rootLayoutDevPath) {
          const conventionalPaths = this.projectPaths.layoutProbePaths;
          this.rootLayoutDevPath =
            conventionalPaths.find((path) =>
              existsSync(join(this.projectPaths.workspaceRoot, path)),
            ) ?? null;
          if (this.rootLayoutDevPath) {
            this.logger.log(`✓ Found root layout at ${this.rootLayoutDevPath}`);
          }
        }
        this.rootLayoutChecked = true;

        if (this.rootLayoutDevPath) {
          const layoutModule = await this.vite.ssrLoadModule(
            '/' + this.rootLayoutDevPath,
          );
          this.rootLayout = (layoutModule as ViewModule).default;
          return this.rootLayout;
        }

        this.rootLayout = null;
        return null;
      } else {
        // In production, get layout from the entry-server bundle: Vite bundles
        // every view into it, so the layout is not a separate file. Prefer the
        // manifest, which knows the emitted name (.mjs for CommonJS projects,
        // .js for ES module projects); fall back to the historical name.
        const entryServerPath =
          resolveServerEntryFromManifest(
            this.serverManifest,
            this.projectPaths.serverDistDir,
          ) ?? join(this.projectPaths.serverDistDir, 'entry-server.mjs');
        if (existsSync(entryServerPath)) {
          const entryModule = (await import(
            entryServerPath
          )) as ServerEntryModule;
          if (entryModule.getRootLayout) {
            this.rootLayout = entryModule.getRootLayout();
            if (this.rootLayout) {
              this.logger.log(`✓ Loaded root layout from entry-server bundle`);
              this.rootLayoutChecked = true;
              return this.rootLayout;
            }
          }
        }
      }

      this.rootLayoutChecked = true;
      this.rootLayout = null;
      return null;
    } catch (error) {
      this.logger.warn(
        `⚠️  Error loading root layout: ${getErrorMessage(error)}`,
      );
      this.rootLayoutChecked = true;
      this.rootLayout = null;
      // Re-discover next time in development (e.g. the file was removed)
      this.rootLayoutDevPath = null;
      return null;
    }
  }

  /**
   * Main render method that routes to string or stream mode
   *
   * String mode (default):
   * - Returns complete HTML string
   * - Atomic responses - works completely or fails completely
   * - Proper HTTP status codes always
   *
   * Stream mode:
   * - Writes directly to response
   * - Better TTFB, progressive rendering
   * - Requires response object
   *
   * @param nonce - Optional CSP nonce applied to injected script tags
   * @param signal - Request-scoped abort signal. Aborting it stops stream
   *   rendering and releases the renderer's resources; in string mode it
   *   rejects the pending render.
   * @param limits - Effective route limits for client-visible metadata.
   */
  async render(
    viewComponent: AnyComponent,
    data: RenderPayload,
    res?: SSRResponse,
    head?: HeadData,
    nonce?: string,
    signal?: AbortSignal,
    limits?: SerializationLimits,
  ): Promise<string | void> {
    // Merge default head with page-specific head
    let mergedHead = this.mergeHead(this.defaultHead, head);

    const renderContext = this.buildRendererContext(nonce, signal);

    const fresh = this.freshViews();
    if (fresh) {
      viewComponent = await fresh.component(viewComponent);
      data = await fresh.payload(data);
    }

    ({ data, head: mergedHead } = this.projectMetadata(
      data,
      mergedHead,
      limits,
      'devalue',
    ));

    if (this.ssrMode === 'stream') {
      if (!res) {
        throw new Error(
          'Response object is required for streaming SSR mode. Pass res as third parameter.',
        );
      }
      return this.streamRenderer.render(
        viewComponent,
        data,
        res,
        renderContext,
        mergedHead,
      );
    }

    try {
      return await this.withTimeout(
        this.stringRenderer.render(
          viewComponent,
          data,
          renderContext,
          mergedHead,
        ),
        `SSR render for ${this.describeView(viewComponent)}`,
        signal,
      );
    } catch (error) {
      // Opt-in (`showErrorPage`): answer with an error page rather than
      // handing the render failure to the exception filters. Deadlines and
      // HTTP errors keep their own handling.
      if (
        !this.showErrorPage ||
        !this.errorHandler ||
        !res ||
        !(error instanceof Error) ||
        error instanceof HttpException ||
        error instanceof RenderDeadlineError
      ) {
        throw error;
      }
      this.errorHandler.handleShellError(
        error,
        res,
        this.describeView(viewComponent),
        this.isDevelopment,
        nonce,
        this.devErrorContext(data),
      );
      return;
    }
  }

  /** What the development error page needs beyond the error itself. */
  private devErrorContext(data: RenderPayload): DevErrorContext | undefined {
    if (!this.isDevelopment) return undefined;
    const context = data.__context as
      { method?: string; url?: string } | undefined;
    return {
      vite: this.vite,
      root: this.projectPaths.projectRoot,
      vitePort: this.vite?.config?.server?.port,
      request: context
        ? { method: context.method, url: context.url }
        : undefined,
    };
  }

  /**
   * Render a segment for client-side navigation.
   * Always uses string mode (streaming not supported for segments).
   */
  async renderSegment(
    viewComponent: AnyComponent,
    data: RenderPayload,
    swapTarget: string,
    head?: HeadData,
    signal?: AbortSignal,
    limits?: SerializationLimits,
  ): Promise<SegmentResponse> {
    let mergedHead = this.mergeHead(this.defaultHead, head);

    const fresh = this.freshViews();
    if (fresh) {
      viewComponent = await fresh.component(viewComponent);
      data = await fresh.payload(data);
    }

    ({ data, head: mergedHead } = this.projectMetadata(
      data,
      mergedHead,
      limits,
      'json',
    ));

    return this.withTimeout(
      this.stringRenderer.renderSegment(
        viewComponent,
        data,
        this.buildRendererContext(undefined, signal),
        swapTarget,
        mergedHead,
      ),
      `SSR segment render for ${this.describeView(viewComponent)}`,
      signal,
    );
  }

  private freshViewsLoader: FreshViews | null | undefined;

  private projectMetadata(
    data: RenderPayload,
    head: HeadData | undefined,
    limits: SerializationLimits | undefined,
    target: SerializationTarget,
  ): { data: RenderPayload; head: HeadData | undefined } {
    if (!limits) return { data, head };
    const projected = this.payloadProjector.projectRenderMetadata(
      data.__layouts,
      head,
      limits,
      target,
    );
    return {
      data: { ...data, __layouts: projected.layouts },
      head: projected.head,
    };
  }

  /**
   * Development view loading for `nestjs-ssr dev` (see FreshViews). Null in
   * production, without Vite, or when the runner did not ask for it.
   */
  private freshViews(): FreshViews | null {
    if (
      this.freshViewsLoader !== undefined &&
      this.freshViewsLoader?.isFor(this.vite)
    ) {
      return this.freshViewsLoader;
    }
    const dev = loadedDevTools();
    this.freshViewsLoader =
      this.vite && dev?.FreshViews.enabled()
        ? new dev.FreshViews(
            this.vite,
            this.projectPaths.sourceRoot,
            this.projectPaths.viteRoot,
          )
        : null;
    return this.freshViewsLoader;
  }

  /**
   * Snapshot of everything renderers need for one render pass
   */
  private buildRendererContext(
    nonce?: string,
    signal?: AbortSignal,
  ): RendererContext {
    return {
      template: this.template,
      vite: this.vite,
      manifest: this.manifest,
      viewIndex: this.viewIndex,
      serverManifest: this.serverManifest,
      entryServerPath: this.entryServerPath,
      serverDistDir: this.projectPaths.serverDistDir,
      isDevelopment: this.isDevelopment,
      timeoutMs: this.timeoutMs,
      nonce,
      signal,
      entryClientDev: this.projectPaths.entryClientDev,
    };
  }

  private describeView(viewComponent: AnyComponent | string): string {
    return typeof viewComponent === 'string'
      ? viewComponent
      : getComponentName(viewComponent, 'anonymous component');
  }

  /**
   * Bound how long `operation` may run.
   *
   * A request-scoped `signal` already carries the resolved deadline: the
   * tighter of the module's `timeout` and any route-tightened
   * `representation.deadlineMs`, enforced by the single timer `RenderScope`
   * started for this request. When one is given, this races `operation`
   * against that signal instead of starting a second, independently-timed
   * one — a route that tightens the deadline then bounds the render itself,
   * and a request that does not still ends at the same instant it always
   * did, since the module default is where that timer's deadline came from.
   *
   * Without a signal (a caller that renders outside the interceptor, e.g. a
   * direct or test call) this falls back to a local timer driven by the
   * module's own configured timeout, exactly as before.
   */
  private async withTimeout<T>(
    operation: Promise<T>,
    label: string,
    signal?: AbortSignal,
  ): Promise<T> {
    if (signal) {
      return this.raceSignal(operation, signal);
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${this.timeoutMs}ms`)),
        this.timeoutMs,
      );
      timer.unref?.();
    });

    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Settle as soon as `operation` finishes or `signal` aborts, whichever is first. */
  private raceSignal<T>(
    operation: Promise<T>,
    signal: AbortSignal,
  ): Promise<T> {
    if (signal.aborted) return Promise.reject(this.abortError(signal));

    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(this.abortError(signal));
      signal.addEventListener('abort', onAbort, { once: true });
      operation.then(resolve, reject).finally(() => {
        signal.removeEventListener('abort', onAbort);
      });
    });
  }

  /** The signal's own abort reason (a `RenderDeadlineError` from `RenderScope`), or a fallback. */
  private abortError(signal: AbortSignal): Error {
    return signal.reason instanceof Error
      ? signal.reason
      : new RenderDeadlineError('Render aborted before it completed', 'abort');
  }

  /**
   * Merge default head with page-specific head
   * Page-specific head values override defaults
   */
  private mergeHead(
    defaultHead?: HeadData,
    pageHead?: HeadData,
  ): HeadData | undefined {
    if (!defaultHead && !pageHead) {
      return undefined;
    }

    return {
      ...defaultHead,
      ...pageHead,
      links: [...(defaultHead?.links || []), ...(pageHead?.links || [])],
      meta: [...(defaultHead?.meta || []), ...(pageHead?.meta || [])],
    };
  }
}
