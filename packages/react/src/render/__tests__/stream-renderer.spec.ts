import { PassThrough } from 'node:stream';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StreamRenderer } from '../renderers/stream-renderer';
import { TemplateParserService } from '../template-parser.service';
import { StreamingErrorHandler } from '../streaming-error-handler';
import type { StreamRenderContext } from '../renderers/stream-renderer';
import { createDefaultTestProjectPaths } from './test-project-paths';

const defaultProjectPaths = createDefaultTestProjectPaths('/project');

const serverModule = vi.hoisted(() => ({
  loadServerModule: vi.fn(),
}));

vi.mock('../server-module-loader', () => ({
  loadServerModule: serverModule.loadServerModule,
}));

const Page = () => null;
Page.displayName = 'ContractPage';

describe('StreamRenderer', () => {
  let renderer: StreamRenderer;

  beforeEach(() => {
    vi.clearAllMocks();
    renderer = new StreamRenderer(
      new TemplateParserService(defaultProjectPaths),
      new StreamingErrorHandler(),
    );
  });

  function createResponse() {
    const stream = new PassThrough();
    const chunks: string[] = [];
    const response = stream as PassThrough & {
      headersSent: boolean;
      statusCode: number;
      setHeader: ReturnType<typeof vi.fn>;
      write: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
    };

    response.headersSent = false;
    response.statusCode = 200;
    response.setHeader = vi.fn();

    const originalWrite = stream.write.bind(stream);
    response.write = vi.fn((chunk: any, ...args: any[]) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : chunk);
      response.headersSent = true;
      return originalWrite(chunk, ...args);
    });

    const originalEnd = stream.end.bind(stream);
    response.end = vi.fn((chunk?: any, ...args: any[]) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : chunk);
      }
      return originalEnd(chunk, ...args);
    });

    const originalOn = stream.on.bind(stream);
    response.on = vi.fn((event: string, handler: (...args: any[]) => void) => {
      originalOn(event, handler);
      return response;
    });

    return { response, chunks };
  }

  function context(template: string): StreamRenderContext {
    return {
      template,
      vite: null,
      manifest: {
        'src/views/entry-client.tsx': {
          file: 'assets/entry-client.js',
          isEntry: true,
          css: ['assets/app.css'],
        },
      },
      serverManifest: null,
      entryServerPath: '/src/views/entry-server.tsx',
      serverDistDir: defaultProjectPaths.serverDistDir,
      entryClientDev: defaultProjectPaths.entryClientDev,
      isDevelopment: false,
      nonce: 'nonce-123',
    };
  }

  function mockStreamingModule(html: string) {
    const abort = vi.fn();
    const pipe = vi.fn((destination: PassThrough) => {
      destination.write(html);
      destination.end();
    });

    serverModule.loadServerModule.mockResolvedValue({
      renderComponentStream: vi.fn((_component, _data, callbacks) => {
        queueMicrotask(() => {
          callbacks.onShellReady();
          callbacks.onAllReady?.();
        });
        return { pipe, abort };
      }),
    });

    return { abort, pipe };
  }

  it('streams hydration scripts outside the root div with nonce and manifest assets', async () => {
    mockStreamingModule('<main>Streamed page</main>');
    const { response, chunks } = createResponse();

    await renderer.render(
      Page,
      {
        data: { price: "costs $' literally" },
        __context: { path: '/stream' },
        __layouts: [],
      },
      response,
      context(`<!DOCTYPE html>
<html>
<head>
  <!--head-meta-->
  <!--styles-->
</head>
<body>
  <div id="root"><!--app-html--></div>
  <!--initial-state-->
  <!--client-scripts-->
</body>
</html>`),
      { title: 'Streaming Contract' },
    );

    const html = chunks.join('');
    const rootStart = html.indexOf('<div id="root">');
    const rootEnd = html.indexOf('</div>', rootStart);
    const rootHtml = html.slice(rootStart, rootEnd);
    const inlineScript = html.indexOf('window.__INITIAL_STATE__');
    const clientScript = html.indexOf('src="/assets/entry-client.js"');

    expect(response.statusCode).toBe(200);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/html; charset=utf-8',
    );
    expect(html).toContain('<title>Streaming Contract</title>');
    expect(html).toContain('<link rel="stylesheet" href="/assets/app.css" />');
    expect(rootHtml).toContain('<main>Streamed page</main>');
    expect(rootHtml).not.toContain('window.__INITIAL_STATE__');
    expect(rootHtml).not.toContain('entry-client.js');
    expect(inlineScript).toBeGreaterThan(rootEnd);
    expect(clientScript).toBeGreaterThan(inlineScript);
    expect(html).toContain('<script nonce="nonce-123">');
    expect(html).toContain(
      '<script type="module" nonce="nonce-123" src="/assets/entry-client.js"></script>',
    );
    expect(html).toContain("costs $' literally");
    expect(html.match(/<\/html>/g)).toHaveLength(1);
  });

  it('appends hydration scripts after the root when legacy templates omit script placeholders', async () => {
    mockStreamingModule('<section>Legacy template</section>');
    const { response, chunks } = createResponse();

    await renderer.render(
      Page,
      { data: {}, __context: {}, __layouts: [] },
      response,
      context(`<!DOCTYPE html>
<html>
<head><!--head-meta--><!--styles--></head>
<body><div id="root"><!--app-html--></div></body>
</html>`),
    );

    const html = chunks.join('');
    const rootEnd = html.indexOf('</div>');
    const inlineScript = html.indexOf('window.__INITIAL_STATE__');
    const clientScript = html.indexOf('src="/assets/entry-client.js"');
    const bodyEnd = html.indexOf('</body>');

    expect(rootEnd).toBeGreaterThan(-1);
    expect(inlineScript).toBeGreaterThan(rootEnd);
    expect(clientScript).toBeGreaterThan(inlineScript);
    expect(bodyEnd).toBeGreaterThan(clientScript);
  });
});
