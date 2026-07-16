import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
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
import type { RendererContext, ViteManifest } from './server-module-loader';
import { isDevelopmentEnv, warnIfNodeEnvUnset } from './environment.util';

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
  private serverManifest: ViteManifest | null = null;
  private isDevelopment: boolean;
  private ssrMode: SSRMode;
  private readonly entryServerPath: string;
  private rootLayout: any | null | undefined = undefined;
  private rootLayoutChecked = false;
  private rootLayoutDevPath: string | null = null;

  constructor(
    private readonly stringRenderer: StringRenderer,
    private readonly streamRenderer: StreamRenderer,
    @Inject(SSR_PROJECT_PATHS)
    private readonly projectPaths: NestSsrProjectPaths,
    @Optional() @Inject('SSR_MODE') ssrMode?: SSRMode,
    @Optional() @Inject('DEFAULT_HEAD') private readonly defaultHead?: HeadData,
    @Optional() @Inject('CUSTOM_TEMPLATE') customTemplate?: string,
  ) {
    this.isDevelopment = isDevelopmentEnv();
    warnIfNodeEnvUnset(this.logger);

    // Default to 'string' mode - simpler, atomic responses, proper HTTP status codes
    this.ssrMode = ssrMode || (process.env.SSR_MODE as SSRMode) || 'string';

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
    } catch (error: any) {
      throw new Error(
        `Failed to read custom template file at ${customTemplatePath}: ${error.message}`,
      );
    }
  }

  private loadDefaultTemplate(): string {
    let templatePath: string;

    if (this.isDevelopment) {
      const packageTemplatePaths = [
        join(__dirname, '../templates/index.html'),
        join(__dirname, '../src/templates/index.html'),
        join(__dirname, '../../src/templates/index.html'),
      ];
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
    } catch (error: any) {
      throw new Error(
        `Failed to read template file at ${templatePath}: ${error.message}`,
      );
    }
  }

  private loadManifests(): void {
    const manifestPath = join(
      this.projectPaths.clientDistDir,
      '.vite/manifest.json',
    );
    if (existsSync(manifestPath)) {
      this.manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    } else {
      this.logger.warn(
        '⚠️  Client manifest not found. Run `pnpm build:client` first.',
      );
    }

    const serverManifestPath = join(
      this.projectPaths.serverDistDir,
      '.vite/manifest.json',
    );
    if (existsSync(serverManifestPath)) {
      this.serverManifest = JSON.parse(
        readFileSync(serverManifestPath, 'utf-8'),
      );
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
  async getRootLayout(): Promise<any | null> {
    if (this.rootLayoutChecked && !this.vite) {
      return this.rootLayout;
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
          this.rootLayout = layoutModule.default;
          return this.rootLayout;
        }

        this.rootLayout = null;
        return null;
      } else {
        // In production, get layout from entry-server bundle
        // Vite bundles everything into entry-server.mjs, so we can't import separate files
        const entryServerPath = join(
          this.projectPaths.serverDistDir,
          'entry-server.mjs',
        );
        if (existsSync(entryServerPath)) {
          const entryModule = await import(entryServerPath);
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
    } catch (error: any) {
      this.logger.warn(`⚠️  Error loading root layout: ${error.message}`);
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
   */
  async render(
    viewComponent: any,
    data: any = {},
    res?: SSRResponse,
    head?: HeadData,
    nonce?: string,
  ): Promise<string | void> {
    // Merge default head with page-specific head
    const mergedHead = this.mergeHead(this.defaultHead, head);

    const renderContext = this.buildRendererContext(nonce);

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

    return this.stringRenderer.render(
      viewComponent,
      data,
      renderContext,
      mergedHead,
    );
  }

  /**
   * Render a segment for client-side navigation.
   * Always uses string mode (streaming not supported for segments).
   */
  async renderSegment(
    viewComponent: any,
    data: any,
    swapTarget: string,
    head?: HeadData,
  ): Promise<SegmentResponse> {
    const mergedHead = this.mergeHead(this.defaultHead, head);

    return this.stringRenderer.renderSegment(
      viewComponent,
      data,
      this.buildRendererContext(),
      swapTarget,
      mergedHead,
    );
  }

  /**
   * Snapshot of everything renderers need for one render pass
   */
  private buildRendererContext(nonce?: string): RendererContext {
    return {
      template: this.template,
      vite: this.vite,
      manifest: this.manifest,
      serverManifest: this.serverManifest,
      entryServerPath: this.entryServerPath,
      serverDistDir: this.projectPaths.serverDistDir,
      isDevelopment: this.isDevelopment,
      nonce,
      entryClientDev: this.projectPaths.entryClientDev,
    };
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
