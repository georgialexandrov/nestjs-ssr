import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import type { ViteDevServer } from 'vite';
import type { Response } from 'express';
import type { SSRMode, HeadData, SegmentResponse } from '../interfaces';
import { StringRenderer } from './renderers/string-renderer';
import { StreamRenderer } from './renderers/stream-renderer';

interface ViteManifest {
  [key: string]: {
    file: string;
    src?: string;
    isEntry?: boolean;
    imports?: string[];
    css?: string[];
  };
}

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
 * - Progressive rendering with Suspense
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

  constructor(
    private readonly stringRenderer: StringRenderer,
    private readonly streamRenderer: StreamRenderer,
    @Optional() @Inject('SSR_MODE') ssrMode?: SSRMode,
    @Optional() @Inject('DEFAULT_HEAD') private readonly defaultHead?: HeadData,
    @Optional() @Inject('CUSTOM_TEMPLATE') customTemplate?: string,
  ) {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    // Default to 'string' mode - simpler, atomic responses, proper HTTP status codes
    this.ssrMode = ssrMode || (process.env.SSR_MODE as SSRMode) || 'string';

    // Resolve entry-server.tsx path for Vite
    const absoluteServerPath = join(__dirname, '/templates/entry-server.tsx');
    const relativeServerPath = relative(process.cwd(), absoluteServerPath);

    if (relativeServerPath.startsWith('..')) {
      this.entryServerPath = absoluteServerPath;
    } else {
      this.entryServerPath = '/' + relativeServerPath.replace(/\\/g, '/');
    }

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
      : join(process.cwd(), customTemplate);

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
      const localTemplatePath = join(process.cwd(), 'src/views/index.html');

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
      templatePath = join(process.cwd(), 'dist/client/index.html');

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
    const manifestPath = join(process.cwd(), 'dist/client/.vite/manifest.json');
    if (existsSync(manifestPath)) {
      this.manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    } else {
      this.logger.warn(
        '⚠️  Client manifest not found. Run `pnpm build:client` first.',
      );
    }

    const serverManifestPath = join(
      process.cwd(),
      'dist/server/.vite/manifest.json',
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
   */
  async getRootLayout(): Promise<any | null> {
    if (this.rootLayoutChecked) {
      return this.rootLayout;
    }

    this.rootLayoutChecked = true;

    const conventionalPaths = [
      'src/views/layout.tsx',
      'src/views/layout/index.tsx',
      'src/views/_layout.tsx',
    ];

    try {
      for (const path of conventionalPaths) {
        const absolutePath = join(process.cwd(), path);

        if (!existsSync(absolutePath)) {
          continue;
        }

        this.logger.log(`✓ Found root layout at ${path}`);

        if (this.vite) {
          const layoutModule = await this.vite.ssrLoadModule('/' + path);
          this.rootLayout = layoutModule.default;
          return this.rootLayout;
        } else {
          const prodPath = path
            .replace('src/views', 'dist/server/views')
            .replace('.tsx', '.js');
          const absoluteProdPath = join(process.cwd(), prodPath);

          if (existsSync(absoluteProdPath)) {
            const layoutModule = await import(absoluteProdPath);
            this.rootLayout = layoutModule.default;
            return this.rootLayout;
          }
        }
      }

      this.rootLayout = null;
      return null;
    } catch (error: any) {
      this.logger.warn(`⚠️  Error loading root layout: ${error.message}`);
      this.rootLayout = null;
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
   */
  async render(
    viewComponent: any,
    data: any = {},
    res?: Response,
    head?: HeadData,
  ): Promise<string | void> {
    // Merge default head with page-specific head
    const mergedHead = this.mergeHead(this.defaultHead, head);

    // Build render context for renderers
    const renderContext = {
      template: this.template,
      vite: this.vite,
      manifest: this.manifest,
      serverManifest: this.serverManifest,
      entryServerPath: this.entryServerPath,
      isDevelopment: this.isDevelopment,
    };

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

    const renderContext = {
      template: this.template,
      vite: this.vite,
      manifest: this.manifest,
      serverManifest: this.serverManifest,
      entryServerPath: this.entryServerPath,
      isDevelopment: this.isDevelopment,
    };

    return this.stringRenderer.renderSegment(
      viewComponent,
      data,
      renderContext,
      swapTarget,
      mergedHead,
    );
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
