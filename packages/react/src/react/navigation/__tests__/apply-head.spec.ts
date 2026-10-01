import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEGMENT_SCHEMA_VERSION } from '../segment-schema';
import type { HeadData } from '../../../interfaces/render-response.interface';

vi.mock('../hydrate-segment', () => ({ hydrateSegment: vi.fn() }));

function segment(componentName: string, head?: HeadData): string {
  return JSON.stringify({
    v: SEGMENT_SCHEMA_VERSION,
    html: `<div>${componentName}</div>`,
    head,
    props: {},
    swapTarget: 'RootLayout',
    componentName,
    context: {
      url: `/${componentName.toLowerCase()}`,
      path: `/${componentName.toLowerCase()}`,
      query: {},
      params: {},
      method: 'GET',
    },
    layouts: [],
  });
}

describe('client-side head sync', () => {
  let navigation: typeof import('../navigate');

  beforeEach(async () => {
    vi.resetModules();
    navigation = await import('../navigate');
    document.body.innerHTML =
      '<div data-layout="RootLayout"><main data-outlet="RootLayout"></main></div>';
    delete window.__VIEW_LOADERS__;
    delete window.__HEAD__;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.head.innerHTML = '';
  });

  /** One navigation, with a single-use fetch mock returning `head` for `componentName`. */
  async function navigateWith(
    url: string,
    componentName: string,
    head?: HeadData,
  ): Promise<void> {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(segment(componentName, head), { status: 200 }),
        ),
      ),
    );
    await navigation.navigate(url);
  }

  it('removes a server-rendered tag the very first client-side navigation drops', async () => {
    // What TemplateParserService.buildHeadTags would have rendered for the
    // initial page, and what its hydration script recorded in __HEAD__.
    document.head.innerHTML =
      '<title>Home</title>' +
      '<meta name="description" content="Home page" />' +
      '<meta property="og:image" content="https://x.example/home.png" />' +
      '<link rel="canonical" href="https://x.example/home" />';
    window.__HEAD__ = {
      title: 'Home',
      description: 'Home page',
      ogImage: 'https://x.example/home.png',
      canonical: 'https://x.example/home',
    };

    await navigateWith('/about', 'About', { title: 'About' });

    expect(document.title).toBe('About');
    expect(document.querySelector('meta[name="description"]')).toBeNull();
    expect(document.querySelector('meta[property="og:image"]')).toBeNull();
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('clears the title instead of leaving it stale when the new page sets none', async () => {
    document.title = 'Home';
    window.__HEAD__ = { title: 'Home' };

    await navigateWith('/blank', 'Blank', {});

    expect(document.title).toBe('');
  });

  it('never touches a tag the application manages outside head', async () => {
    document.head.innerHTML =
      '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
      '<meta name="theme-color" content="#123456" />';
    // No window.__HEAD__ at all: nothing was ever rendered through `head:`.

    await navigateWith('/dashboard', 'Dashboard', { title: 'Dashboard' });

    expect(
      document.querySelector('meta[name="viewport"]')?.getAttribute('content'),
    ).toBe('width=device-width, initial-scale=1');
    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute('content'),
    ).toBe('#123456');
    expect(document.title).toBe('Dashboard');
  });

  it('updates a repeated head.meta/head.links entry in place and removes one the new page drops', async () => {
    await navigateWith('/a', 'A', {
      meta: [{ name: 'author', content: 'Alice' }],
      links: [{ rel: 'icon', href: '/a.ico' }],
    });
    expect(
      document.querySelector('meta[name="author"]')?.getAttribute('content'),
    ).toBe('Alice');
    expect(document.querySelector('link[rel="icon"]')).not.toBeNull();

    await navigateWith('/b', 'B', {
      meta: [{ name: 'author', content: 'Bob' }],
    });

    // Reused, not duplicated.
    expect(document.querySelectorAll('meta[name="author"]')).toHaveLength(1);
    expect(
      document.querySelector('meta[name="author"]')?.getAttribute('content'),
    ).toBe('Bob');
    expect(document.querySelector('link[rel="icon"]')).toBeNull();
  });

  it('enforces the server attribute allowlist on custom link entries', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // rel="icon" rather than "stylesheet": happy-dom actually fetches
    // stylesheets it finds in the DOM, which is unrelated noise this test
    // doesn't want. The allowlist itself doesn't care which rel is used.
    const links = [
      {
        rel: 'icon',
        href: '/x.ico',
        integrity: 'sha384-x',
        onload: 'alert(1)',
      },
    ] as unknown as HeadData['links'];

    await navigateWith('/styled', 'Styled', { links });

    const link = document.querySelector('link[rel="icon"]');
    expect(link?.getAttribute('integrity')).toBe('sha384-x');
    expect(link?.hasAttribute('onload')).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it('works with no SSR head baseline at all', async () => {
    await expect(
      navigateWith('/first', 'First', { title: 'First' }),
    ).resolves.toBeUndefined();
    expect(document.title).toBe('First');
  });
});
