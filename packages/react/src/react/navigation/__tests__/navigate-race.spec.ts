import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEGMENT_SCHEMA_VERSION } from '../segment-schema';
import { hydrateSegment } from '../hydrate-segment';

vi.mock('../hydrate-segment', () => ({ hydrateSegment: vi.fn() }));

function segment(componentName: string): string {
  return JSON.stringify({
    v: SEGMENT_SCHEMA_VERSION,
    html: `<div>${componentName}</div>`,
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

/** A `fetch()` call the test controls the resolution of, one per call. */
interface PendingFetch {
  url: string;
  signal?: AbortSignal;
  resolve: (body: string) => void;
  reject: (error: unknown) => void;
}

describe('navigate() overlapping-navigation safety', () => {
  let navigation: typeof import('../navigate');
  let pending: PendingFetch[];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    navigation = await import('../navigate');
    document.body.innerHTML =
      '<div data-layout="RootLayout"><main data-outlet="RootLayout"></main></div>';
    delete window.__VIEW_LOADERS__;

    pending = [];
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      return new Promise<Response>((resolvePromise, rejectPromise) => {
        pending.push({
          url,
          signal: init?.signal,
          resolve: (body: string) =>
            resolvePromise(new Response(body, { status: 200 })),
          reject: rejectPromise,
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (document as { startViewTransition?: unknown }).startViewTransition;
  });

  it("the later click wins even though the earlier one's response arrives last", async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const origin = window.location.origin;
    const pushStateSpy = vi.spyOn(history, 'pushState');

    const first = navigation.navigate('/a');
    const second = navigation.navigate('/b');

    expect(pending).toHaveLength(2);
    // Starting the second navigation aborts the first's in-flight fetch...
    expect(pending[0].signal?.aborted).toBe(true);

    // ...but the network resolves out of order anyway: the older request
    // ("a", clicked first) is the one that actually arrives last.
    pending[1].resolve(segment('B'));
    pending[0].resolve(segment('A'));

    await Promise.all([first, second]);

    expect(document.querySelector('[data-outlet]')?.innerHTML).toBe(
      '<div>B</div>',
    );
    expect(window.__COMPONENT_NAME__).toBe('B');
    expect(pushStateSpy).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).toHaveBeenCalledWith({ url: '/b' }, '', '/b');
    expect(vi.mocked(hydrateSegment)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(hydrateSegment).mock.calls[0][1]).toBe('B');

    // A superseded navigation is not an error: no fallback reload for /a (that
    // would have set location.href directly, never going through pushState),
    // and nothing logged. The only URL change on record is the winner's own
    // pushState, asserted above.
    expect(window.location.href).toBe(`${origin}/b`);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('does not resurrect a stale click over a newer one, no matter how many pile up', async () => {
    const calls = [
      navigation.navigate('/a', { replace: true, scroll: false }),
      navigation.navigate('/b', { replace: true, scroll: false }),
      navigation.navigate('/c', { replace: true, scroll: false }),
    ];
    expect(pending).toHaveLength(3);

    // Resolve in an order that puts the latest click (c) neither first nor
    // last, so a correct result can only come from tracking click order.
    pending[1].resolve(segment('B'));
    pending[2].resolve(segment('C'));
    pending[0].resolve(segment('A'));

    await Promise.all(calls);

    expect(document.querySelector('[data-outlet]')?.innerHTML).toBe(
      '<div>C</div>',
    );
    expect(window.__COMPONENT_NAME__).toBe('C');
    expect(vi.mocked(hydrateSegment)).toHaveBeenCalledTimes(1);
  });

  it('clears the loading state exactly once, when the winning navigation finishes', async () => {
    const states: Array<'idle' | 'loading'> = [];
    navigation.registerNavigationState((state) => states.push(state));

    const first = navigation.navigate('/a');
    const second = navigation.navigate('/b');
    pending[1].resolve(segment('B'));
    pending[0].resolve(segment('A'));
    await Promise.all([first, second]);

    // Both calls announce "loading" as soon as they start; only the winner
    // (b) may announce "idle" — the loser finishing afterwards must not flip
    // the indicator back on/off out of turn.
    expect(states).toEqual(['loading', 'loading', 'idle']);
  });

  it('does not poison the prefetch cache when an unrelated navigation races it', async () => {
    navigation.prefetch('/warm');
    expect(pending).toHaveLength(1);
    const warmFetch = pending[0];
    // prefetch()'s own request has no navigation to belong to, so it is
    // never given an AbortSignal in the first place.
    expect(warmFetch.signal).toBeUndefined();

    const other = navigation.navigate('/elsewhere');
    expect(pending).toHaveLength(2);
    pending[1].resolve(segment('Elsewhere'));
    await other;

    // The click on the (still unresolved) warmed link reuses the prefetch
    // rather than issuing a third request.
    const warmNav = navigation.navigate('/warm');
    warmFetch.resolve(segment('Warm'));
    await warmNav;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-outlet]')?.innerHTML).toBe(
      '<div>Warm</div>',
    );
  });

  it('refuses a cross-origin response reached through a same-origin redirect', async () => {
    const response = new Response(segment('Attacker'), { status: 200 });
    Object.defineProperties(response, {
      redirected: { value: true },
      url: { value: 'https://attacker.example/segment' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await navigation.navigate('/redirect', { scroll: false });

    expect(document.querySelector('[data-outlet]')?.innerHTML).toBe('');
    expect(vi.mocked(hydrateSegment)).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Navigation failed:',
      expect.objectContaining({
        message: 'Navigation failed: segment response changed origin',
      }),
    );
  });

  it('accepts a same-origin redirected segment response', async () => {
    const response = new Response(segment('Home'), { status: 200 });
    Object.defineProperties(response, {
      redirected: { value: true },
      url: { value: `${window.location.origin}/destination` },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    );

    await navigation.navigate('/redirect', { scroll: false });

    expect(document.querySelector('[data-outlet]')?.innerHTML).toBe(
      '<div>Home</div>',
    );
  });

  it('a transition-failure retry cannot resurrect a stale navigation over a newer one', async () => {
    // Stands in for a browser's View Transitions API: the swap callback runs
    // synchronously (as real implementations do). Only the *first* call's
    // `.finished` is left pending, so its `catch`-driven retry in
    // `swapContent` can be triggered at a precise, chosen moment; later calls
    // (nav b's own, normal transition) settle immediately.
    let staleFinishedReject!: (error: unknown) => void;
    let transitionCalls = 0;
    (document as { startViewTransition?: unknown }).startViewTransition = vi.fn(
      (callback: () => void) => {
        callback();
        transitionCalls += 1;
        return {
          finished:
            transitionCalls === 1
              ? new Promise((_resolve, reject) => {
                  staleFinishedReject = reject;
                })
              : Promise.resolve(),
        };
      },
    );

    const first = navigation.navigate('/a');
    expect(pending).toHaveLength(1);
    pending[0].resolve(segment('A'));
    await vi.waitFor(() =>
      expect(document.querySelector('[data-outlet]')?.innerHTML).toBe(
        '<div>A</div>',
      ),
    );

    // A newer navigation starts and completes while /a's transition is still
    // unresolved, and writes its own content over /a's.
    const second = navigation.navigate('/b');
    expect(pending).toHaveLength(2);
    pending[1].resolve(segment('B'));
    await second;
    expect(document.querySelector('[data-outlet]')?.innerHTML).toBe(
      '<div>B</div>',
    );

    // /a's transition now reports failure; its retry must not clobber /b.
    staleFinishedReject(new Error('transition interrupted'));
    await first;

    expect(document.querySelector('[data-outlet]')?.innerHTML).toBe(
      '<div>B</div>',
    );
  });
});
