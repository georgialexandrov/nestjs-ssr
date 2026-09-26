import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { RenderInterceptor } from '../render.interceptor';
import { RenderService } from '../render.service';
import {
  RENDER_KEY,
  RENDER_OPTIONS_KEY,
} from '../../decorators/react-render.decorator';
import {
  api,
  page,
  representations,
} from '../../interfaces/representation.interface';
import { resolveModulePolicy } from '../pipeline/representation-policy';
import { SEGMENT_MEDIA_TYPE } from '../pipeline/negotiator';
import { resetPublicContextDiagnostics } from '../pipeline/public-context';
import { PublicPayloadProjector } from '../pipeline/public-payload';
import type { RenderOptions } from '../../decorators/react-render.decorator';
import type { RenderConfig } from '../../interfaces';

const TestComponent = () => null;
TestComponent.displayName = 'TestComponent';

/**
 * A response that records headers the way both adapters do, so one set of
 * expectations covers Express and Fastify.
 */
function createResponse(kind: 'express' | 'fastify') {
  const headers = new Map<string, string>();

  if (kind === 'express') {
    return {
      headers,
      response: {
        headersSent: false,
        type: vi.fn((value: string) => headers.set('content-type', value)),
        set: (name: string, value: string) =>
          headers.set(name.toLowerCase(), value),
        getHeader: (name: string) => headers.get(name.toLowerCase()),
        setHeader: (name: string, value: string) =>
          headers.set(name.toLowerCase(), value),
        vary: (field: string) => {
          const existing = headers.get('vary');
          headers.set('vary', existing ? `${existing}, ${field}` : field);
        },
      } as Record<string, unknown>,
    };
  }

  return {
    headers,
    response: {
      sent: false,
      header: (name: string, value: string) =>
        headers.set(name.toLowerCase(), value),
      raw: {
        headersSent: false,
        getHeader: (name: string) => headers.get(name.toLowerCase()),
        setHeader: (name: string, value: string) =>
          headers.set(name.toLowerCase(), value),
      },
    } as Record<string, unknown>,
  };
}

describe('representation pipeline', () => {
  let reflector: Reflector;
  let renderService: {
    render: ReturnType<typeof vi.fn>;
    renderSegment: ReturnType<typeof vi.fn>;
    getRootLayout: ReturnType<typeof vi.fn>;
  };
  let handler: CallHandler;

  beforeEach(() => {
    resetPublicContextDiagnostics();

    reflector = { get: vi.fn() } as unknown as Reflector;
    renderService = {
      render: vi.fn().mockResolvedValue('<html>page</html>'),
      renderSegment: vi.fn().mockResolvedValue({ html: '<div />' }),
      getRootLayout: vi.fn().mockResolvedValue(null),
    };
    handler = { handle: vi.fn() } as unknown as CallHandler;
  });

  function setupRoute(options?: RenderOptions) {
    vi.mocked(reflector.get).mockImplementation((key: unknown) => {
      if (key === RENDER_KEY) return TestComponent;
      if (key === RENDER_OPTIONS_KEY) return options;
      return undefined;
    });
  }

  function createInterceptor(
    config: RenderConfig & { adapter?: 'express' | 'fastify' } = {},
    projector?: PublicPayloadProjector,
  ) {
    const modulePolicy = resolveModulePolicy({
      policy: config.representation,
      jsonApi: config.jsonApi,
      timeoutMs: config.timeout,
    });

    return new RenderInterceptor(
      reflector,
      renderService as unknown as RenderService,
      config.allowedHeaders,
      config.allowedCookies,
      config.context,
      config.jsonApi,
      config.clientNavigation,
      config.cspNonce,
      modulePolicy,
      projector,
    );
  }

  function run(
    interceptor: RenderInterceptor,
    data: unknown,
    request: Record<string, unknown> = {},
    adapter: 'express' | 'fastify' = 'express',
  ) {
    const { response, headers } = createResponse(adapter);
    const context = {
      getHandler: () => TestComponent,
      getClass: () => ({ name: 'TestController' }),
      switchToHttp: () => ({
        getRequest: () => ({
          url: '/test',
          path: '/test',
          method: 'GET',
          query: {},
          params: {},
          headers: {},
          ...request,
        }),
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    vi.mocked(handler.handle).mockReturnValue(of(data));

    return {
      headers,
      response,
      result: firstValueFrom(interceptor.intercept(context, handler)),
    };
  }

  describe('explicit representations', () => {
    it('serves the page representation as HTML', async () => {
      setupRoute();
      const interceptor = createInterceptor({ representation: { json: true } });

      const { result, headers } = run(
        interceptor,
        representations({
          html: page({ props: { view: 'model' } }),
          json: api({ dto: true }),
        }),
      );

      expect(await result).toBe('<html>page</html>');
      expect(headers.get('content-type')).toBe('text/html');
      expect(renderService.render).toHaveBeenCalledWith(
        TestComponent,
        expect.objectContaining({ data: { view: 'model' } }),
        expect.anything(),
        undefined,
        undefined,
        expect.any(AbortSignal),
      );
    });

    it('serves the API representation as JSON', async () => {
      setupRoute();
      const interceptor = createInterceptor({ representation: { json: true } });

      const { result, headers } = run(
        interceptor,
        representations({
          html: page({ props: { view: 'model' } }),
          json: api({ dto: true }),
        }),
        { headers: { accept: 'application/json' } },
      );

      expect(await result).toEqual({ dto: true });
      expect(headers.get('content-type')).toBe('application/json');
      expect(renderService.render).not.toHaveBeenCalled();
    });

    it('never evaluates the representation it did not select', async () => {
      setupRoute();
      const interceptor = createInterceptor({ representation: { json: true } });
      const buildDto = vi.fn(() => ({ dto: true }));

      const { result } = run(
        interceptor,
        representations({
          html: page({ props: {} }),
          json: api(buildDto),
        }),
      );

      await result;
      expect(buildDto).not.toHaveBeenCalled();
    });

    it('offers JSON on a route whose module policy leaves it off', async () => {
      setupRoute();
      const interceptor = createInterceptor();

      const { result } = run(
        interceptor,
        representations({ html: page({ props: {} }), json: api({ ok: true }) }),
        { headers: { accept: 'application/json' } },
      );

      expect(await result).toEqual({ ok: true });
    });

    it('honours a route that explicitly disables JSON', async () => {
      setupRoute({ representation: { json: false } });
      const interceptor = createInterceptor({ representation: { json: true } });

      const { result } = run(
        interceptor,
        representations({ html: page({ props: {} }), json: api({ ok: true }) }),
        { headers: { accept: 'application/json' } },
      );

      await expect(result).rejects.toThrow(HttpException);
    });

    it('serves an api()-only route and refuses an explicit HTML request', async () => {
      setupRoute();
      const interceptor = createInterceptor();

      const json = run(interceptor, api({ ok: true }), {
        headers: { accept: 'application/json' },
      });
      expect(await json.result).toEqual({ ok: true });

      const html = run(interceptor, api({ ok: true }), {
        headers: { accept: 'text/html' },
      });
      await expect(html.result).rejects.toThrow(HttpException);

      // No stated preference gets the only representation there is.
      const wildcard = run(interceptor, api({ ok: true }), {
        headers: { accept: '*/*' },
      });
      expect(await wildcard.result).toEqual({ ok: true });
    });
  });

  describe('the public data boundary', () => {
    it('serializes only the projected DTO for each channel', async () => {
      setupRoute();
      const interceptor = createInterceptor({ representation: { json: true } });

      const domainUser = {
        id: 7,
        name: 'Ada',
        passwordHash: 'do-not-ship-this',
        internalNotes: 'nor this',
      };

      const html = run(
        interceptor,
        representations({
          html: page({ props: { user: { id: domainUser.id } } }),
          json: api({ id: domainUser.id, name: domainUser.name }),
        }),
      );
      await html.result;

      const hydrationPayload = JSON.stringify(
        renderService.render.mock.calls[0][1],
      );
      expect(hydrationPayload).not.toContain('do-not-ship-this');
      expect(hydrationPayload).not.toContain('nor this');
      expect(hydrationPayload).not.toContain('Ada');

      const json = run(
        interceptor,
        representations({
          html: page({ props: { user: { id: domainUser.id } } }),
          json: api({ id: domainUser.id, name: domainUser.name }),
        }),
        { headers: { accept: 'application/json' } },
      );

      expect(JSON.stringify(await json.result)).not.toContain(
        'do-not-ship-this',
      );
    });

    it('does not freeze or reuse controller-owned props', async () => {
      setupRoute();
      const interceptor = createInterceptor({
        representation: { limits: { mode: 'enforce' } },
      });
      const nested = { name: 'Ada' };
      const props = { user: nested };

      const { result } = run(interceptor, props);
      await result;

      const rendered = renderService.render.mock.calls[0][1].data;
      expect(rendered).not.toBe(props);
      expect(rendered.user).not.toBe(nested);
      expect(Object.isFrozen(rendered)).toBe(true);
      expect(Object.isFrozen(props)).toBe(false);
      expect(Object.isFrozen(nested)).toBe(false);
    });

    it('lets the context projector strip what the factory attached', async () => {
      setupRoute();
      const contextFactory = () => ({
        user: { id: 1, name: 'Ada', sessionToken: 'tok_secret' },
      });

      const withoutProjector = new RenderInterceptor(
        reflector,
        renderService as unknown as RenderService,
        undefined,
        undefined,
        contextFactory,
      );

      const before = run(withoutProjector, { ok: true });
      await before.result;
      // The raw factory value reaches the client, which is exactly why
      // projectContext exists.
      expect(JSON.stringify(renderService.render.mock.calls[0][1])).toContain(
        'tok_secret',
      );

      renderService.render.mockClear();

      const withProjector = new RenderInterceptor(
        reflector,
        renderService as unknown as RenderService,
        undefined,
        undefined,
        contextFactory,
        undefined,
        undefined,
        undefined,
        undefined,
        new PublicPayloadProjector(({ context }) => ({
          ...context,
          user: { id: (context as { user: { id: number } }).user.id },
        })),
      );

      const after = run(withProjector, { ok: true });
      await after.result;

      const payload = JSON.stringify(renderService.render.mock.calls[0][1]);
      expect(payload).not.toContain('tok_secret');
      expect(payload).not.toContain('Ada');
      expect(payload).toContain('"user":{"id":1}');
    });

    it('preserves application context overrides for headers and cookies', async () => {
      setupRoute();
      const interceptor = createInterceptor({
        allowedHeaders: ['x-tenant-id'],
        allowedCookies: ['theme'],
        context: () => ({
          headers: { application: 'owned' },
          cookies: { preference: 'compact' },
        }),
      });

      const { result } = run(
        interceptor,
        { ok: true },
        {
          headers: { 'x-tenant-id': 'request-value' },
          cookies: { theme: 'dark' },
        },
      );
      await result;

      const context = renderService.render.mock.calls[0][1].__context;
      expect(context.headers).toEqual({ application: 'owned' });
      expect(context.cookies).toEqual({ preference: 'compact' });
      expect(context['x-tenant-id']).toBe('request-value');
    });

    it('reports an unserializable value but still renders, by default', async () => {
      // Warn mode is what makes this release safe to adopt: a payload that
      // renders today must keep rendering.
      setupRoute();
      const interceptor = createInterceptor();

      const { result } = run(interceptor, { onClick: () => 'nope' });

      expect(await result).toBe('<html>page</html>');
      expect(renderService.render).toHaveBeenCalled();
    });

    it('reports an over-limit payload but still renders, by default', async () => {
      setupRoute();
      const interceptor = createInterceptor({
        representation: { limits: { maxBytes: 256 } },
      });

      const { result } = run(interceptor, { blob: 'x'.repeat(4096) });

      expect(await result).toBe('<html>page</html>');
    });

    it('refuses the payload once limits are enforced', async () => {
      setupRoute();
      const interceptor = createInterceptor({
        representation: { limits: { mode: 'enforce' } },
      });

      const { result } = run(interceptor, { onClick: () => 'nope' });

      await expect(result).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
      expect(renderService.render).not.toHaveBeenCalled();
    });

    it('refuses an over-limit payload once limits are enforced', async () => {
      setupRoute();
      const interceptor = createInterceptor({
        representation: { limits: { mode: 'enforce', maxBytes: 256 } },
      });

      const { result } = run(interceptor, { blob: 'x'.repeat(4096) });

      await expect(result).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('exposes allowed headers only inside the context bag', async () => {
      setupRoute();
      const interceptor = createInterceptor({
        allowedHeaders: ['x-tenant-id'],
        allowedCookies: ['theme'],
      });

      const { result } = run(
        interceptor,
        { ok: true },
        {
          headers: { 'x-tenant-id': 'acme', authorization: 'Bearer secret' },
          cookies: { theme: 'dark', session: 'secret' },
        },
      );
      await result;

      const context = renderService.render.mock.calls[0][1].__context;
      expect(context.headers).toEqual({ 'x-tenant-id': 'acme' });
      expect(context.cookies).toEqual({ theme: 'dark' });
      expect(JSON.stringify(context)).not.toContain('Bearer secret');
    });
  });

  describe('response policy', () => {
    it.each(['express', 'fastify'] as const)(
      'adds no headers of its own on %s until asked',
      async (adapter) => {
        setupRoute();
        const interceptor = createInterceptor();

        const { result, headers } = run(interceptor, { ok: true }, {}, adapter);
        await result;

        // Vary is what previous releases already sent, and negotiation
        // correctness depends on it.
        expect(headers.get('vary')).toBe('Accept, X-Current-Layouts');
        // Everything else stays off, so upgrading changes no response.
        expect(headers.get('cache-control')).toBeUndefined();
        expect(headers.get('x-content-type-options')).toBeUndefined();
        expect(headers.get('referrer-policy')).toBeUndefined();
      },
    );

    it.each(['express', 'fastify'] as const)(
      'applies the policy on %s once an application configures one',
      async (adapter) => {
        setupRoute();
        const interceptor = createInterceptor({
          representation: { securityHeaders: { nosniff: true } },
        });

        const { result, headers } = run(interceptor, { ok: true }, {}, adapter);
        await result;

        expect(headers.get('cache-control')).toBe('private, no-store');
        expect(headers.get('x-content-type-options')).toBe('nosniff');
        expect(headers.get('referrer-policy')).toBe(
          'strict-origin-when-cross-origin',
        );
      },
    );

    it.each(['express', 'fastify'] as const)(
      'produces equivalent JSON responses on %s',
      async (adapter) => {
        setupRoute();
        const interceptor = createInterceptor({
          representation: { json: true },
        });

        const { result, headers } = run(
          interceptor,
          representations({ html: page({ props: {} }), json: api({ id: 1 }) }),
          { headers: { accept: 'application/json' } },
          adapter,
        );

        expect(await result).toEqual({ id: 1 });
        expect(headers.get('content-type')).toBe('application/json');
      },
    );

    it('emits an explicit public cache policy with composed keys', async () => {
      setupRoute({
        representation: {
          cache: {
            visibility: 'public',
            maxAge: 300,
            keys: ['Accept-Language'],
          },
        },
      });
      const interceptor = createInterceptor();

      const { result, headers } = run(interceptor, { ok: true });
      await result;

      expect(headers.get('cache-control')).toBe('public, max-age=300');
      expect(headers.get('vary')).toBe(
        'Accept, X-Current-Layouts, Accept-Language',
      );
    });

    it('sets Vary before throwing 406, so the refusal is cacheable', async () => {
      setupRoute();
      const interceptor = createInterceptor();

      const { result, headers } = run(
        interceptor,
        { ok: true },
        {
          headers: { accept: 'application/json' },
        },
      );

      await expect(result).rejects.toThrow(HttpException);
      expect(headers.get('vary')).toBe('Accept, X-Current-Layouts');
    });
  });

  describe('segments', () => {
    it('derives the segment from the HTML representation, not the API DTO', async () => {
      setupRoute();
      const interceptor = createInterceptor({ representation: { json: true } });
      renderService.getRootLayout.mockResolvedValue(
        Object.assign(() => null, { displayName: 'RootLayout' }),
      );
      renderService.renderSegment.mockResolvedValue({ html: '<div />' });

      const { result, headers } = run(
        interceptor,
        representations({
          html: page({ props: { view: 'model' } }),
          json: api({ dto: 'api-only' }),
        }),
        {
          headers: {
            accept: 'application/json',
            'x-current-layouts': 'RootLayout',
          },
        },
      );

      await result;
      expect(headers.get('content-type')).toBe(SEGMENT_MEDIA_TYPE);
      expect(renderService.renderSegment).toHaveBeenCalledWith(
        TestComponent,
        expect.objectContaining({ data: { view: 'model' } }),
        'RootLayout',
        undefined,
        expect.any(AbortSignal),
      );
    });
  });

  describe('deadlines', () => {
    it('turns a pre-commit deadline into a 503', async () => {
      setupRoute();
      const interceptor = createInterceptor({
        representation: { deadlineMs: 20 },
      });
      renderService.render.mockImplementation(() => new Promise(() => {}));

      const { result } = run(interceptor, { ok: true });

      await expect(result).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });

    it('covers an asynchronous context factory and passes its signal', async () => {
      setupRoute();
      let receivedSignal: AbortSignal | undefined;
      const interceptor = createInterceptor({
        representation: { deadlineMs: 20 },
        context: ({ signal }) => {
          receivedSignal = signal;
          return new Promise(() => {});
        },
      });

      const { result } = run(interceptor, { ok: true });

      await expect(result).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
      expect(receivedSignal).toBeInstanceOf(AbortSignal);
      expect(receivedSignal?.aborted).toBe(true);
    });

    it('covers an asynchronous context projector', async () => {
      setupRoute();
      const projector = new PublicPayloadProjector(() => new Promise(() => {}));
      const interceptor = createInterceptor(
        { representation: { deadlineMs: 20 } },
        projector,
      );

      const { result } = run(interceptor, { ok: true });

      await expect(result).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });

    it('passes the scope signal to a selected lazy representation', async () => {
      setupRoute();
      const lazy = vi.fn((signal: AbortSignal) => new Promise(() => {}));
      const interceptor = createInterceptor({
        representation: { deadlineMs: 20 },
      });

      const { result } = run(interceptor, api(lazy), {
        headers: { accept: 'application/json' },
      });

      await expect(result).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
      expect(lazy).toHaveBeenCalledWith(expect.any(AbortSignal));
      expect(lazy.mock.calls[0][0].aborted).toBe(true);
    });

    it('does not replace a post-commit timeout with a 503', async () => {
      setupRoute();
      const interceptor = createInterceptor({
        representation: { deadlineMs: 20 },
      });
      renderService.render.mockImplementation(() => new Promise(() => {}));

      const execution = run(interceptor, { ok: true });
      execution.response.headersSent = true;

      await expect(execution.result).resolves.toBeUndefined();
    });
  });

  describe('legacy compatibility', () => {
    it('passes a raw controller string through unchanged', async () => {
      setupRoute();
      const interceptor = createInterceptor();

      const { result, headers } = run(interceptor, '<html>raw</html>');

      expect(await result).toBe('<html>raw</html>');
      expect(headers.size).toBe(0);
      expect(renderService.render).not.toHaveBeenCalled();
    });

    it('keeps serving page props as JSON for a jsonApi route', async () => {
      setupRoute();
      const interceptor = createInterceptor({ jsonApi: true });

      const { result } = run(
        interceptor,
        { recipes: ['lohikeitto'] },
        {
          headers: { accept: 'application/json' },
        },
      );

      expect(await result).toEqual({ recipes: ['lohikeitto'] });
    });
  });
});
