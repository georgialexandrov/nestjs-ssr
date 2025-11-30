import { Injectable } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import serialize from 'serialize-javascript';
import type { ViteDevServer } from 'vite';

interface ViteManifest {
  [key: string]: {
    file: string;
    src?: string;
    isEntry?: boolean;
    imports?: string[];
    css?: string[];
  };
}

@Injectable()
export class RenderService {
  private vite: ViteDevServer | null = null;
  private template: string;
  private manifest: ViteManifest | null = null;
  private serverManifest: ViteManifest | null = null;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';

    // Load HTML template
    const templatePath = this.isDevelopment
      ? join(process.cwd(), 'src/view/template.html')
      : join(process.cwd(), 'dist/client/template.html');

    this.template = readFileSync(templatePath, 'utf-8');

    // In production, load the Vite manifests to get hashed filenames
    if (!this.isDevelopment) {
      // Load client manifest
      const manifestPath = join(process.cwd(), 'dist/client/.vite/manifest.json');
      if (existsSync(manifestPath)) {
        this.manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      } else {
        console.warn('⚠️  Client manifest not found. Run `pnpm build:client` first.');
      }

      // Load server manifest
      const serverManifestPath = join(process.cwd(), 'dist/server/.vite/manifest.json');
      if (existsSync(serverManifestPath)) {
        this.serverManifest = JSON.parse(readFileSync(serverManifestPath, 'utf-8'));
      } else {
        console.warn('⚠️  Server manifest not found. Run `pnpm build:server` first.');
      }
    }
  }

  setViteServer(vite: ViteDevServer) {
    this.vite = vite;
  }

  async render(viewPath: string, data: any = {}): Promise<string> {
    try {
      let template = this.template;

      // In development, transform the template with Vite
      if (this.vite) {
        template = await this.vite.transformIndexHtml('/', template);
      }

      // Import and use the SSR render function
      let renderModule;
      if (this.vite) {
        // Development: Use Vite's SSR loading with HMR support
        renderModule = await this.vite.ssrLoadModule('/src/view/entry-server.tsx');
      } else {
        // Production: Import the built server bundle using manifest
        if (this.serverManifest && this.serverManifest['src/view/entry-server.tsx']) {
          const serverFile = this.serverManifest['src/view/entry-server.tsx'].file;
          const serverPath = join(process.cwd(), 'dist/server', serverFile);
          renderModule = await import(serverPath);
        } else {
          throw new Error(
            'Server bundle not found in manifest. Run `pnpm build:server` to generate the server bundle.',
          );
        }
      }

      // Extract data and context
      const { data: pageData, __context: context } = data;

      // Render the React component
      const appHtml = await renderModule.renderComponent(viewPath, data);

      // Serialize initial state and context for client
      const initialStateScript = `
        <script>
          window.__INITIAL_STATE__ = ${serialize(pageData, { isJSON: true })};
          window.__CONTEXT__ = ${serialize(context, { isJSON: true })};
          window.__COMPONENT_PATH__ = ${serialize(viewPath, { isJSON: true })};
        </script>
      `;

      // Inject client script
      let clientScript = '';
      if (this.vite) {
        // Development: Use Vite's direct module loading
        clientScript = `<script type="module" src="/src/view/entry-client.tsx"></script>`;
      } else {
        // Production: Use manifest to get hashed filename
        if (this.manifest && this.manifest['src/view/entry-client.tsx']) {
          const entryFile = this.manifest['src/view/entry-client.tsx'].file;
          clientScript = `<script type="module" src="/${entryFile}"></script>`;
        } else {
          console.error('⚠️  Client entry not found in manifest');
          clientScript = `<script type="module" src="/assets/client.js"></script>`;
        }
      }

      // Replace placeholders
      let html = template.replace('<!--app-html-->', appHtml);
      html = html.replace('<!--initial-state-->', initialStateScript);
      html = html.replace('<!--client-scripts-->', clientScript);

      return html;
    } catch (error) {
      console.error('Render error:', error);
      throw error;
    }
  }
}
