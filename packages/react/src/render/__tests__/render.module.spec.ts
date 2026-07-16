import { describe, it, expect } from 'vitest';
import { RenderModule } from '../render.module';
import { SSR_PROJECT_PATHS } from '../../config/nest-project-resolver';

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
