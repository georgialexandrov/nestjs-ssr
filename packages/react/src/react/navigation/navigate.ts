import type { SegmentResponse } from '../../interfaces/segment.interface';
import type {
  HeadData,
  HeadLinkAttributes,
  HeadMetaAttributes,
} from '../../interfaces/render-response.interface';
import {
  HEAD_FIELDS,
  ALLOWED_HEAD_ATTRIBUTES,
  type HeadFieldDescriptor,
} from '../../interfaces/head-fields';
import { hydrateSegment } from './hydrate-segment';
import { updatePageContext } from '../hooks/use-page-context';
import { resolveSameOriginUrl } from './same-origin';
import { validateSegmentResponse } from './segment-schema';
import { writeSegmentHtml } from './dom-update-adapter';
import { loadViewModules } from './lazy-views';

export interface NavigateOptions {
  /** Use replaceState instead of pushState. Default: false */
  replace?: boolean;
  /** Scroll to top after navigation. Default: true */
  scroll?: boolean;
}

/** How long a prefetched segment may be used for the navigation it was for. */
const PREFETCH_TTL_MS = 10_000;

/** Segments fetched ahead of a navigation, by URL and current layouts. */
const prefetched = new Map<
  string,
  { at: number; response: Promise<SegmentResponse> }
>();

/**
 * Identifies "the latest call to `navigate()`". Incremented once per call,
 * synchronously, before anything is awaited — so the moment a second click
 * (or a popstate spam) calls `navigate()` again, every checkpoint an older,
 * still-in-flight call reaches afterwards sees a stale id and bails out
 * instead of applying its (now outdated) response. This is what makes
 * "latest navigation wins" hold regardless of which fetch resolves first.
 */
let navigationSequence = 0;

/**
 * AbortController for the segment fetch of whichever `navigate()` call is
 * still running. A new call aborts it before starting its own — best-effort:
 * if the fetch is already resolved, or the runtime ignores the signal, the
 * `navigationSequence` check below is what actually keeps the stale response
 * from being applied. Never used for `prefetch()`'s own fetch, which has no
 * navigation to belong to and must survive being superseded — aborting it
 * would leave a rejected promise sitting in `prefetched` for a later, real
 * click on that link to trip over.
 */
let inFlightController: AbortController | null = null;

// Module-level state setter for non-React contexts
let setNavigationState: ((state: 'idle' | 'loading') => void) | null = null;

/**
 * Register the navigation state setter from NavigationProvider.
 * Called automatically when NavigationProvider mounts.
 */
export function registerNavigationState(
  setter: (state: 'idle' | 'loading') => void,
): void {
  setNavigationState = setter;
}

/**
 * Navigate to a new URL using client-side segment rendering.
 *
 * Only same-origin http(s) URLs are accepted. A segment response is parsed as
 * JSON and its `html` written into the DOM, so honouring a cross-origin target
 * would let any third-party server that sends permissive CORS headers inject
 * markup into this origin. Callers that pass a URL derived from user input
 * (a `?next=` parameter, a stored redirect) rely on this check, so it happens
 * before the request is made rather than in the `Link` component alone.
 * Cross-origin targets are refused outright — this function is for in-app
 * navigation; use `window.location` directly to leave the app.
 *
 * Falls back to full page navigation if:
 * - No layouts are present in the DOM
 * - No common ancestor layout exists between current and target page
 * - The fetch fails
 *
 * Overlapping calls (a second click before the first's response lands, or
 * back/forward spam through the popstate handler) resolve in whatever order
 * their fetches happen to finish. Only the *latest* call may ever reach the
 * DOM, history or globals: it aborts the previous call's in-flight fetch and
 * takes a fresh navigation id, and every checkpoint below that would touch
 * anything visible re-checks that id first. A call that loses the race is not
 * a failure — it is discarded silently, with no fallback reload, no error
 * state and nothing logged.
 */
export async function navigate(
  url: string,
  options: NavigateOptions = {},
): Promise<void> {
  const { replace = false, scroll = true } = options;

  const parsedUrl = resolveSameOriginUrl(url);
  if (!parsedUrl) {
    console.error(
      `[navigation] Refusing to navigate to "${url}": only same-origin ` +
        'http(s) URLs can be client-side navigated. Assign to ' +
        'window.location to leave the application.',
    );
    return;
  }

  // Supersede whatever navigation is still running. The id is captured now,
  // synchronously — every later `isCurrent()` check compares against it, so a
  // still-in-flight older call can tell it lost the race the instant this one
  // started, without waiting for either fetch to resolve.
  const navId = ++navigationSequence;
  inFlightController?.abort();
  const controller = new AbortController();
  inFlightController = controller;
  const isCurrent = () => navId === navigationSequence;

  setNavigationState?.('loading');

  // Optimistically update the path immediately for instant UI feedback
  const currentContext = window.__CONTEXT__;
  if (currentContext) {
    const optimisticContext = {
      ...currentContext,
      path: parsedUrl.pathname,
      url,
    };
    updatePageContext(optimisticContext);
  }

  try {
    // 1. Get current layouts from DOM
    const currentLayouts = getCurrentLayouts();
    if (currentLayouts.length === 0) {
      // No layouts = fall back to full navigation
      window.location.href = parsedUrl.href;
      return;
    }

    // 2. Single request with all current layouts, unless a prefetch for
    // this URL and these layouts is still fresh.
    // The already-resolved href is passed rather than the caller's string so
    // fetch cannot resolve it differently from the origin check above.
    // The prefetch path is never given this navigation's signal: it belongs
    // to a hover/focus that may never turn into a click, and aborting it here
    // would leave a rejected promise in the prefetch cache for a later click
    // on the same link to trip over.
    const response = await (takePrefetched(parsedUrl.href, currentLayouts) ??
      fetchSegment(parsedUrl.href, currentLayouts, controller.signal));

    // A newer navigation started while this fetch was in flight. It already
    // owns the DOM; applying this response now would silently undo it.
    if (!isCurrent()) return;

    // 3. If no common ancestor, server returns swapTarget: null
    if (!response.swapTarget) {
      window.location.href = parsedUrl.href;
      return;
    }

    // With lazily loaded views (window.__VIEW_LOADERS__), fetch the page's
    // and its layouts' modules now, in parallel with the DOM swap.
    const modulesReady = loadSegmentModules(response);

    // 4. Swap content with View Transitions API. `isCurrent` is threaded in
    // so the actual DOM write can be skipped even if it happens inside a
    // view-transition callback that runs after a newer navigation resumed.
    const outlet = await swapContent(
      response.html,
      response.swapTarget,
      isCurrent,
    );

    // Superseded while the swap/transition was in flight.
    if (!isCurrent()) return;

    if (modulesReady) {
      const modules = await modulesReady;
      // Superseded while the lazily-loaded view module was still loading —
      // this is the "abort isn't honoured" case: the fetch already returned,
      // there is nothing left to cancel, but the id check still keeps a
      // module registry meant for a discarded page out of window.__MODULES__.
      if (!isCurrent()) return;
      window.__MODULES__ = modules;
    }

    // 5. Update context BEFORE hydrating so segment providers get correct values
    if (response.context) {
      // Update root provider state (for components in main tree)
      updatePageContext(response.context);
      // Update window.__CONTEXT__ for segment providers
      window.__CONTEXT__ = response.context;
    }

    // 6. Hydrate the swapped segment with its layouts
    if (outlet) {
      hydrateSegment(
        outlet,
        response.componentName,
        response.props,
        response.layouts,
      );
    }

    // 7. Update history
    if (replace) {
      history.replaceState({ url }, '', url);
    } else {
      history.pushState({ url }, '', url);
    }

    // 8. Update head — always, even without response.head: the destination
    // page may simply have dropped a tag the previous one set.
    applyHead(response.head);

    // 8. Scroll to top
    if (scroll) {
      window.scrollTo(0, 0);
    }

    // 9. Update globals for future navigations
    window.__COMPONENT_NAME__ = response.componentName;
    window.__INITIAL_STATE__ = response.props;
  } catch (error) {
    // A superseded navigation's fetch rejects with AbortError once the
    // controller above is aborted (when the runtime honours it at all) —
    // that is this call losing the race, not a failure, so it is discarded
    // exactly like any other stale continuation: silently, via isCurrent().
    if (!isCurrent()) return;
    console.error('Navigation failed:', error);
    // Fall back to full navigation on error
    window.location.href = parsedUrl.href;
  } finally {
    // Only the still-current navigation may clear the loading state — an
    // older call finishing (or being discarded) after it lost the race must
    // not flip the indicator off while the winning navigation is still in
    // flight.
    if (isCurrent()) setNavigationState?.('idle');
  }
}

/**
 * Fetch the segment for `url`, and then its page's code, ahead of a
 * navigation to it (`<Link prefetch>` on hover and focus). A navigation to
 * the same URL within a few seconds uses the result instead of fetching
 * again. Failures are silent: the navigation fetches as usual.
 */
export function prefetch(url: string): void {
  const parsedUrl = resolveSameOriginUrl(url);
  const layouts = getCurrentLayouts();
  if (!parsedUrl || layouts.length === 0) return;
  const key = `${parsedUrl.href}\n${layouts.join(',')}`;
  const existing = prefetched.get(key);
  if (existing && Date.now() - existing.at < PREFETCH_TTL_MS) return;

  const response = fetchSegment(parsedUrl.href, layouts);
  prefetched.set(key, { at: Date.now(), response });
  response.then(loadSegmentModules).catch(() => prefetched.delete(key));
}

/** A fresh prefetched segment for this navigation, used once. */
function takePrefetched(
  url: string,
  layouts: string[],
): Promise<SegmentResponse> | undefined {
  const key = `${url}\n${layouts.join(',')}`;
  const entry = prefetched.get(key);
  prefetched.delete(key);
  return entry && Date.now() - entry.at < PREFETCH_TTL_MS
    ? entry.response
    : undefined;
}

/** Load the page's and its layouts' view modules, when views load lazily. */
function loadSegmentModules(response: SegmentResponse) {
  const loaders = window.__VIEW_LOADERS__;
  return loaders && response.swapTarget
    ? loadViewModules(loaders, [
        response.componentName,
        ...(response.layouts ?? []).map((layout) => layout.name),
      ])
    : undefined;
}

/**
 * Get the names of all layouts currently in the DOM.
 * Reads from data-layout attributes.
 */
function getCurrentLayouts(): string[] {
  return Array.from(document.querySelectorAll('[data-layout]')).map((el) =>
    el.getAttribute('data-layout')!,
  );
}

/**
 * Fetch a segment from the server and validate it before the caller can act
 * on it.
 *
 * The body is read as text first so its size can be checked against the
 * segment limit before it is parsed, and the parsed value is then held to the
 * segment schema — including that the swap target actually exists in this
 * document. A response that fails any of those checks throws, and the caller
 * falls back to a full navigation.
 *
 * @param signal - Aborts the fetch when a newer navigation supersedes this
 *   one. Omitted by `prefetch()`, whose request has no navigation to belong
 *   to and must run to completion regardless of what the user does next.
 */
async function fetchSegment(
  url: string,
  currentLayouts: string[],
  signal?: AbortSignal,
): Promise<SegmentResponse> {
  const res = await fetch(url, {
    headers: { 'X-Current-Layouts': currentLayouts.join(',') },
    signal,
  });
  // fetch follows redirects by default. The requested URL was same-origin,
  // but a redirect can land on a CORS-enabled third-party response whose
  // `html` would otherwise be written into this document.
  if (
    (res.url && !resolveSameOriginUrl(res.url)) ||
    (res.redirected && !res.url)
  ) {
    throw new Error('Navigation failed: segment response changed origin');
  }
  if (!res.ok) {
    throw new Error(`Navigation failed: ${res.status}`);
  }

  const body = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error('Navigation failed: segment response is not valid JSON');
  }

  const validation = validateSegmentResponse(parsed, {
    byteLength: body.length,
    availableTargets: currentLayouts,
  });

  if (!validation.ok) {
    throw new Error(
      `Navigation failed: rejected segment response (${validation.reason}) — ${validation.detail}`,
    );
  }

  return validation.value;
}

/**
 * Swap content in the outlet, optionally using View Transitions API.
 *
 * @param isCurrent - Whether the navigation this swap belongs to is still the
 *   latest one. Checked again right before the actual write: a view
 *   transition's callback runs synchronously when it is started, but its
 *   `.finished` promise (and the `catch` below, which re-invokes the same
 *   callback if the transition itself fails) can resume after a newer
 *   navigation has already written its own content into this outlet — this
 *   is what stops that resumed write from clobbering it.
 */
async function swapContent(
  html: string,
  swapTarget: string,
  isCurrent: () => boolean,
): Promise<Element | null> {
  const outlet = document.querySelector(`[data-outlet="${swapTarget}"]`);
  if (!outlet) {
    // Outlet not found, fall back to full navigation
    window.location.reload();
    return null;
  }

  const swap = () => {
    if (!isCurrent()) return;
    writeSegmentHtml(outlet, html);
  };

  // Use View Transitions API if available (progressive enhancement).
  // The DOM lib declares this unconditionally, but browsers without support
  // do not define it, so the check is a real runtime guard.
  if (typeof document.startViewTransition === 'function') {
    try {
      await document.startViewTransition(swap).finished;
    } catch {
      // View transition failed, just do the swap
      swap();
    }
  } else {
    swap();
  }

  return outlet;
}

/**
 * Head data most recently applied to the document: either what the server
 * rendered (read lazily from `window.__HEAD__` — see `initialHead` below) or
 * the `head` of the last page navigated to. `applyHead` diffs the incoming
 * head against this value to decide what to remove: only a field or entry
 * that appears *here* is ever a removal candidate, which is what keeps a tag
 * the application added outside `head` untouched, and is also what lets a
 * tag the server rendered be recognised and removed on the very first
 * client-side navigation, without marking the server's HTML at all.
 */
let previousHead: HeadData | undefined;
let previousHeadRead = false;

/**
 * `window.__HEAD__` is written by the server's hydration script, so it only
 * exists once that script has run — read it lazily, once, rather than at
 * module load, since nothing here needs it before the first navigation.
 */
function initialHead(): HeadData | undefined {
  if (!previousHeadRead) {
    previousHeadRead = true;
    previousHead = window.__HEAD__;
  }
  return previousHead;
}

/**
 * Apply a page's head data to the document: `<title>`, the fixed SEO/OG
 * fields, and arbitrary `head.links` / `head.meta` entries.
 *
 * Shares `HEAD_FIELDS` and `ALLOWED_HEAD_ATTRIBUTES` with the server's
 * `buildHeadTags` (`interfaces/head-fields.ts`) by construction: a fixed
 * field the server knows how to render, this function knows how to find,
 * update and remove, and a custom attribute the server would refuse to
 * render is refused here too — one list, read by both sides.
 *
 * Called on every navigation, even one with no `head` at all, since the
 * destination page may simply have dropped a tag the previous one set.
 */
function applyHead(head?: HeadData): void {
  const prev = initialHead();
  const next = head ?? {};

  for (const field of HEAD_FIELDS) {
    const value = next[field.key];
    if (typeof value === 'string' && value) {
      applyFixedField(field, value);
    } else if (prev && typeof prev[field.key] === 'string' && prev[field.key]) {
      // The previous page set this field and the new one doesn't: remove it
      // rather than leave it stale. A field neither page ever set is left
      // alone, so a tag the application manages itself is never touched.
      applyFixedField(field, undefined);
    }
  }

  reconcileTags('meta', prev?.meta, next.meta, metaKey, metaElKey);
  reconcileTags('link', prev?.links, next.links, linkKey, linkElKey);

  previousHead = head;
}

/**
 * Set, update or remove the single tag a fixed `HeadData` field owns.
 * `field.attrValue` (`"description"`, `"og:title"`, `"canonical"`, ...) is
 * one of this module's own constants, never derived from head data, so
 * interpolating it into the selector below carries no injection risk — only
 * `value`, which goes through `setAttribute` rather than into a selector or
 * HTML string, needs no escaping at all.
 */
function applyFixedField(
  field: HeadFieldDescriptor,
  value: string | undefined,
): void {
  if (field.tag === 'title') {
    document.title = value ?? '';
    return;
  }

  let el = document.querySelector(
    `${field.tag}[${field.attr}="${field.attrValue}"]`,
  );
  if (value === undefined) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement(field.tag);
    el.setAttribute(field.attr!, field.attrValue!);
    document.head.appendChild(el);
  }
  el.setAttribute(field.tag === 'link' ? 'href' : 'content', value);
}

/** Identity of a `head.meta` entry, and of the `<meta>` DOM element it maps to — by whichever of charset/name/property is set. `null` means it can't be found again later, so it is always created fresh and never removed. */
function metaKey(m: HeadMetaAttributes): string | null {
  if (m.charset != null) return 'charset';
  if (m.name != null) return `name:${m.name}`;
  if (m.property != null) return `property:${m.property}`;
  return null;
}
function metaElKey(el: Element): string | null {
  if (el.hasAttribute('charset')) return 'charset';
  const name = el.getAttribute('name');
  if (name !== null) return `name:${name}`;
  const property = el.getAttribute('property');
  return property !== null ? `property:${property}` : null;
}

/** Identity of a `head.links` entry (`rel` + `href`, both required), and of the `<link>` element it maps to. */
function linkKey(l: HeadLinkAttributes): string {
  return `${l.rel}\n${l.href}`;
}
function linkElKey(el: Element): string {
  return `${el.getAttribute('rel')}\n${el.getAttribute('href')}`;
}

/**
 * Reconcile the previous page's `head.meta`/`head.links` against the new
 * page's: update or create every entry `next` lists, then remove whichever of
 * `prev`'s entries `next` no longer repeats. Elements are matched by scanning
 * the DOM for the identity `elKey` computes (rather than a CSS attribute
 * selector built from the entry itself), so an attacker-controlled value
 * can't be read as selector syntax.
 */
function reconcileTags<T extends Record<string, any>>(
  tag: 'meta' | 'link',
  prev: T[] | undefined,
  next: T[] | undefined,
  key: (entry: T) => string | null,
  elKey: (el: Element) => string | null,
): void {
  const els = Array.from(document.head.querySelectorAll(tag));
  const find = (k: string | null) =>
    k === null ? null : els.find((el) => elKey(el) === k);
  const nextKeys = new Set(
    (next ?? []).map(key).filter((k): k is string => k !== null),
  );
  for (const entry of prev ?? []) {
    const k = key(entry);
    if (k !== null && !nextKeys.has(k)) find(k)?.remove();
  }
  for (const entry of next ?? []) {
    const el =
      find(key(entry)) ??
      document.head.appendChild(document.createElement(tag));
    applyAttributes(el, tag, entry);
  }
}

/**
 * Set `attrs` on `el`, dropping anything outside `ALLOWED_HEAD_ATTRIBUTES` —
 * the same allowlist the server enforces, so a client-side navigation can
 * never apply an attribute (`onload`, `onerror`, ...) the server would have
 * refused to render — and clearing whatever `el` previously carried that
 * `attrs` no longer includes, so a tag reused across navigations doesn't
 * accumulate stale attributes.
 */
function applyAttributes(
  el: Element,
  tag: 'link' | 'meta',
  attrs: Record<string, any>,
): void {
  const allowed = ALLOWED_HEAD_ATTRIBUTES[tag];
  const wanted = new Map<string, string>();
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    const name = key.toLowerCase();
    if (!allowed.has(name)) {
      console.warn(
        `[navigation] Skipping unsafe or unsupported attribute "${key}" on <${tag}> head tag`,
      );
      continue;
    }
    wanted.set(name, String(value));
  }
  for (const attr of Array.from(el.attributes)) {
    if (!wanted.has(attr.name)) el.removeAttribute(attr.name);
  }
  for (const [name, value] of wanted) el.setAttribute(name, value);
}
