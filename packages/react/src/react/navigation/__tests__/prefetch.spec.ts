import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEGMENT_SCHEMA_VERSION } from '../segment-schema';

vi.mock('../hydrate-segment', () => ({ hydrateSegment: vi.fn() }));

function segment(componentName: string) {
  return JSON.stringify({
    v: SEGMENT_SCHEMA_VERSION,
    html: `<div>${componentName}</div>`,
    props: {},
    swapTarget: 'RootLayout',
    componentName,
    context: {
      url: '/recipes',
      path: '/recipes',
      query: {},
      params: {},
      method: 'GET',
    },
    layouts: [],
  });
}

describe('prefetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let navigation: typeof import('../navigate');

  beforeEach(async () => {
    vi.resetModules();
    navigation = await import('../navigate');
    document.body.innerHTML =
      '<div data-layout="RootLayout"><main data-outlet="RootLayout"></main></div>';
    fetchMock = vi.fn(() =>
      Promise.resolve(new Response(segment('RecipeList'), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    delete window.__VIEW_LOADERS__;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('lets the navigation use the prefetched segment instead of fetching again', async () => {
    navigation.prefetch('/recipes');
    await navigation.navigate('/recipes');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-outlet]')?.innerHTML).toBe(
      '<div>RecipeList</div>',
    );
  });

  it('fetches once for repeated hovers', () => {
    navigation.prefetch('/recipes');
    navigation.prefetch('/recipes');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not reuse a prefetch that has gone stale', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    navigation.prefetch('/recipes');
    vi.setSystemTime(Date.now() + 60_000);
    await navigation.navigate('/recipes');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('starts loading the page code once the segment names it', async () => {
    const loader = vi.fn(() =>
      Promise.resolve({
        default: Object.assign(() => null, { displayName: 'RecipeList' }),
      }),
    );
    window.__VIEW_LOADERS__ = { '/src/views/recipe-list.tsx': loader };
    navigation.prefetch('/recipes');
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
  });

  it('ignores cross-origin URLs', () => {
    navigation.prefetch('https://elsewhere.example/recipes');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries after a failed prefetch', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(new Response('nope', { status: 500 })),
    );
    navigation.prefetch('/recipes');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    navigation.prefetch('/recipes');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
