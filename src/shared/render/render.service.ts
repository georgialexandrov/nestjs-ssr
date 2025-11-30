import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import serialize from 'serialize-javascript';
import type { ViteDevServer } from 'vite';

@Injectable()
export class RenderService {
  private vite: ViteDevServer | null = null;
  private template: string;

  constructor() {
    // Load HTML template
    this.template = readFileSync(
      join(process.cwd(), 'src/view/template.html'),
      'utf-8',
    );
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
        // In development, use Vite's SSR loading
        renderModule = await this.vite.ssrLoadModule(
          '/src/view/entry-server.tsx',
        );
      } else {
        // In production, use built files
        renderModule = await import('../../view/entry-server.js');
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
      const clientScript = this.vite
        ? `<script type="module" src="/src/view/entry-client.tsx"></script>`
        : `<script type="module" src="/assets/entry-client.js"></script>`;

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
