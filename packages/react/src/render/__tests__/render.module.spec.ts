import { describe, it, expect } from 'vitest';
import { RenderModule } from '../render.module';

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
