import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  adaptControllerResult,
  resetLegacyDiagnostics,
  type AdaptOptions,
} from '../legacy-result-adapter';
import { RenderConfigurationError } from '../errors';
import {
  api,
  page,
  representations,
} from '../../../interfaces/representation.interface';

function options(overrides: Partial<AdaptOptions> = {}): AdaptOptions {
  return {
    legacyCompatibility: true,
    exposePropsAsJson: false,
    viaDeprecatedFlag: false,
    ...overrides,
  };
}

beforeEach(() => {
  resetLegacyDiagnostics();
});

describe('explicit results', () => {
  it('passes a representations() result through', async () => {
    const result = representations({
      html: page({ props: { title: 'Page' } }),
      json: api({ id: 1 }),
    });

    const adapted = adaptControllerResult(result, options());
    expect(adapted.explicit).toBe(true);
    expect(adapted.declares).toEqual({ html: true, json: true });
    expect(await adapted.html!.resolve()).toEqual({ props: { title: 'Page' } });
    expect(await adapted.json!.resolve()).toEqual({ id: 1 });
  });

  it('treats a lone page() as HTML only', () => {
    const adapted = adaptControllerResult(page({ props: {} }), options());
    expect(adapted.declares).toEqual({ html: true, json: false });
  });

  it('treats a lone api() as JSON only', () => {
    const adapted = adaptControllerResult(api({ ok: true }), options());
    expect(adapted.declares).toEqual({ html: false, json: true });
  });

  it('resolves a representation lazily, only when selected', async () => {
    const build = vi.fn(() => ({ id: 1 }));
    const adapted = adaptControllerResult(
      representations({ html: page({ props: {} }), json: api(build) }),
      options(),
    );

    expect(build).not.toHaveBeenCalled();
    await adapted.json!.resolve();
    expect(build).toHaveBeenCalledOnce();
  });

  it('does not add page props as JSON alongside an explicit result', () => {
    const adapted = adaptControllerResult(
      representations({ html: page({ props: { secret: 'view-model' } }) }),
      options({ exposePropsAsJson: true, viaDeprecatedFlag: true }),
    );
    expect(adapted.json).toBeUndefined();
    expect(adapted.declares.json).toBe(false);
  });

  it('does not mistake a domain object with html/json keys for control data', () => {
    const adapted = adaptControllerResult(
      { html: '<p>from the CMS</p>', json: { some: 'data' } },
      options(),
    );
    expect(adapted.explicit).toBe(false);
    expect(adapted.declares).toEqual({ html: true, json: false });
  });
});

describe('legacy results', () => {
  it('wraps plain props as an HTML representation', async () => {
    const adapted = adaptControllerResult({ message: 'hi' }, options());
    expect(await adapted.html!.resolve()).toEqual({ props: { message: 'hi' } });
  });

  it('passes a RenderResponse through unchanged', async () => {
    const adapted = adaptControllerResult(
      { props: { a: 1 }, head: { title: 'T' }, layoutProps: { x: 1 } },
      options(),
    );
    expect(await adapted.html!.resolve()).toEqual({
      props: { a: 1 },
      head: { title: 'T' },
      layoutProps: { x: 1 },
    });
  });

  it('coerces a value with no prop shape into empty props', async () => {
    const adapted = adaptControllerResult(42, options());
    expect(await adapted.html!.resolve()).toEqual({ props: {} });
  });

  it('offers page props as JSON when JSON is enabled for the route', async () => {
    const adapted = adaptControllerResult(
      { recipes: ['lohikeitto'] },
      options({ exposePropsAsJson: true }),
    );
    expect(adapted.declares.json).toBe(true);
    expect(await adapted.json!.resolve()).toEqual({
      recipes: ['lohikeitto'],
    });
  });

  it('warns about the deprecated jsonApi flag in development only', () => {
    const deprecationLogger = { warn: vi.fn() };
    adaptControllerResult(
      { a: 1 },
      options({
        exposePropsAsJson: true,
        viaDeprecatedFlag: true,
        deprecationLogger,
        routeLabel: 'AppController.index',
      }),
    );
    expect(deprecationLogger.warn).toHaveBeenCalledOnce();
    expect(String(deprecationLogger.warn.mock.calls[0][0])).toContain(
      'representations(',
    );
  });

  it('does not warn when JSON was enabled by representation policy', () => {
    const deprecationLogger = { warn: vi.fn() };
    adaptControllerResult(
      { a: 1 },
      options({ exposePropsAsJson: true, deprecationLogger }),
    );
    expect(deprecationLogger.warn).not.toHaveBeenCalled();
  });

  it('warns once per route rather than once per request', () => {
    const deprecationLogger = { warn: vi.fn() };
    for (let i = 0; i < 5; i++) {
      adaptControllerResult(
        { a: 1 },
        options({
          exposePropsAsJson: true,
          viaDeprecatedFlag: true,
          deprecationLogger,
          routeLabel: 'AppController.index',
        }),
      );
    }
    expect(deprecationLogger.warn).toHaveBeenCalledOnce();
  });
});

describe('raw controller strings', () => {
  it('passes a raw string through with a deprecation warning', () => {
    const deprecationLogger = { warn: vi.fn() };
    const adapted = adaptControllerResult(
      '<html>hand-rolled</html>',
      options({ deprecationLogger, routeLabel: 'AppController.raw' }),
    );

    expect(adapted.rawString).toBe('<html>hand-rolled</html>');
    expect(deprecationLogger.warn).toHaveBeenCalledOnce();
    expect(String(deprecationLogger.warn.mock.calls[0][0])).toContain(
      'without @Render()',
    );
  });

  it('fails when legacy compatibility is turned off', () => {
    expect(() =>
      adaptControllerResult(
        '<html></html>',
        options({
          legacyCompatibility: false,
          routeLabel: 'AppController.raw',
        }),
      ),
    ).toThrow(RenderConfigurationError);
  });
});
