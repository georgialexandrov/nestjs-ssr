import { describe, it, expect } from 'vitest';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RenderModule } from '../render.module';
import { SSR_PROJECT_PATHS } from '../../config/nest-project-resolver';

function hasDynamicInterceptorProvider(
  dynamicModule: ReturnType<typeof RenderModule.forRoot>,
): boolean {
  return !!dynamicModule.providers?.some(
    (provider) =>
      typeof provider === 'object' &&
      provider !== null &&
      'provide' in provider &&
      provider.provide === APP_INTERCEPTOR,
  );
}

describe('RenderModule interceptor registration', () => {
  it('does not register a second global interceptor in forRoot()', () => {
    expect(hasDynamicInterceptorProvider(RenderModule.forRoot())).toBe(false);
  });

  it('does not register a second global interceptor in forRootAsync()', () => {
    expect(
      hasDynamicInterceptorProvider(
        RenderModule.forRootAsync({ useFactory: async () => ({}) }),
      ),
    ).toBe(false);
  });
});

describe('RenderModule JSON API config', () => {
  it('should register JSON_API in forRoot()', () => {
    const dynamicModule = RenderModule.forRoot({ jsonApi: true });
    const jsonApiProvider = dynamicModule.providers?.find(
      (provider) =>
        typeof provider === 'object' &&
        provider !== null &&
        'provide' in provider &&
        provider.provide === 'JSON_API',
    );

    expect(jsonApiProvider).toMatchObject({
      provide: 'JSON_API',
      useValue: true,
    });
  });

  it('should register JSON_API in forRootAsync()', async () => {
    const dynamicModule = RenderModule.forRootAsync({
      useFactory: async () => ({ jsonApi: true }),
    });
    const jsonApiProvider = dynamicModule.providers?.find(
      (provider) =>
        typeof provider === 'object' &&
        provider !== null &&
        'provide' in provider &&
        provider.provide === 'JSON_API',
    );

    expect(jsonApiProvider).toBeDefined();
    expect(typeof jsonApiProvider).toBe('object');
    expect('useFactory' in (jsonApiProvider as object)).toBe(true);

    const value = await (
      jsonApiProvider as {
        useFactory: (config: { jsonApi?: boolean }) => boolean;
      }
    ).useFactory({ jsonApi: true });

    expect(value).toBe(true);
  });
});

describe('RenderModule SSR timeout config', () => {
  it('registers the default and configured timeout in forRoot()', () => {
    for (const [config, expected] of [
      [undefined, 10_000],
      [{ timeout: 2500 }, 2500],
    ] as const) {
      const dynamicModule = RenderModule.forRoot(config);
      const provider = dynamicModule.providers?.find(
        (candidate) =>
          typeof candidate === 'object' &&
          candidate !== null &&
          'provide' in candidate &&
          candidate.provide === 'SSR_TIMEOUT',
      );

      expect(provider).toMatchObject({
        provide: 'SSR_TIMEOUT',
        useValue: expected,
      });
    }
  });

  it('registers the configured timeout in forRootAsync()', async () => {
    const dynamicModule = RenderModule.forRootAsync({
      useFactory: async () => ({ timeout: 1234 }),
    });
    const provider = dynamicModule.providers?.find(
      (candidate) =>
        typeof candidate === 'object' &&
        candidate !== null &&
        'provide' in candidate &&
        candidate.provide === 'SSR_TIMEOUT',
    ) as { useFactory: (config: { timeout?: number }) => number };

    expect(provider.useFactory({ timeout: 1234 })).toBe(1234);
  });
});

describe('RenderModule project paths', () => {
  it('should register SSR_PROJECT_PATHS in forRoot()', () => {
    const dynamicModule = RenderModule.forRoot();
    const pathsProvider = dynamicModule.providers?.find(
      (provider) =>
        typeof provider === 'object' &&
        provider !== null &&
        'provide' in provider &&
        provider.provide === SSR_PROJECT_PATHS,
    );

    expect(pathsProvider).toBeDefined();
    expect(pathsProvider).toMatchObject({
      provide: SSR_PROJECT_PATHS,
    });
  });

  it('should register SSR_PROJECT_PATHS in forRootAsync()', () => {
    const dynamicModule = RenderModule.forRootAsync({
      useFactory: async () => ({ project: 'web' }),
    });
    const pathsProvider = dynamicModule.providers?.find(
      (provider) =>
        typeof provider === 'object' &&
        provider !== null &&
        'provide' in provider &&
        provider.provide === SSR_PROJECT_PATHS,
    );

    expect(pathsProvider).toBeDefined();
    expect(typeof pathsProvider).toBe('object');
    expect('useFactory' in (pathsProvider as object)).toBe(true);
  });
});
