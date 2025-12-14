import type { SegmentResponse } from '../../interfaces/segment.interface';
import type { HeadData } from '../../interfaces/render-response.interface';
import { hydrateSegment } from './hydrate-segment';
import { updatePageContext } from '../hooks/use-page-context';

export interface NavigateOptions {
  /** Use replaceState instead of pushState. Default: false */
  replace?: boolean;
  /** Scroll to top after navigation. Default: true */
  scroll?: boolean;
}

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
 * Falls back to full page navigation if:
 * - No layouts are present in the DOM
 * - No common ancestor layout exists between current and target page
 * - The fetch fails
 */
export async function navigate(
  url: string,
  options: NavigateOptions = {},
): Promise<void> {
  const { replace = false, scroll = true } = options;

  setNavigationState?.('loading');

  // Optimistically update the path immediately for instant UI feedback
  const parsedUrl = new URL(url, window.location.origin);
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
      window.location.href = url;
      return;
    }

    // 2. Single request with all current layouts
    const response = await fetchSegment(url, currentLayouts);

    // 3. If no common ancestor, server returns swapTarget: null
    if (!response.swapTarget) {
      window.location.href = url;
      return;
    }

    // 4. Swap content with View Transitions API
    const outlet = await swapContent(response.html, response.swapTarget);

    // 5. Hydrate the swapped segment
    if (outlet) {
      hydrateSegment(outlet, response.componentName, response.props);
    }

    // 6. Update history
    if (replace) {
      history.replaceState({ url }, '', url);
    } else {
      history.pushState({ url }, '', url);
    }

    // 7. Update page context for React hooks (path, params, query, etc.)
    if (response.context) {
      // Update root provider state (for components in main tree)
      updatePageContext(response.context);
      // Update window.__CONTEXT__ for segment providers
      window.__CONTEXT__ = response.context;
    }

    // 8. Update head
    if (response.head) {
      updateHead(response.head);
    }

    // 8. Scroll to top
    if (scroll) {
      window.scrollTo(0, 0);
    }

    // 9. Update globals for future navigations
    window.__COMPONENT_NAME__ = response.componentName;
    window.__INITIAL_STATE__ = response.props;
  } catch (error) {
    console.error('Navigation failed:', error);
    // Fall back to full navigation on error
    window.location.href = url;
  } finally {
    setNavigationState?.('idle');
  }
}

/**
 * Get the names of all layouts currently in the DOM.
 * Reads from data-layout attributes.
 */
function getCurrentLayouts(): string[] {
  return Array.from(document.querySelectorAll('[data-layout]')).map(
    (el) => el.getAttribute('data-layout')!,
  );
}

/**
 * Fetch segment HTML from the server.
 */
async function fetchSegment(
  url: string,
  currentLayouts: string[],
): Promise<SegmentResponse> {
  const res = await fetch(url, {
    headers: { 'X-Current-Layouts': currentLayouts.join(',') },
  });
  if (!res.ok) {
    throw new Error(`Navigation failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Swap content in the outlet, optionally using View Transitions API.
 */
async function swapContent(
  html: string,
  swapTarget: string,
): Promise<Element | null> {
  const outlet = document.querySelector(`[data-outlet="${swapTarget}"]`);
  if (!outlet) {
    // Outlet not found, fall back to full navigation
    window.location.reload();
    return null;
  }

  const swap = () => {
    outlet.innerHTML = html;
  };

  // Use View Transitions API if available (progressive enhancement)
  if ('startViewTransition' in document) {
    try {
      await (document as any).startViewTransition(swap).finished;
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
 * Update document head (title, meta tags, etc.)
 */
function updateHead(head: HeadData): void {
  if (head.title) {
    document.title = head.title;
  }

  const updateMeta = (name: string, content: string) => {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  if (head.description) {
    updateMeta('description', head.description);
  }

  if (head.keywords) {
    updateMeta('keywords', head.keywords);
  }

  // Update Open Graph tags
  const updateOgMeta = (property: string, content: string) => {
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  if (head.ogTitle) {
    updateOgMeta('og:title', head.ogTitle);
  }

  if (head.ogDescription) {
    updateOgMeta('og:description', head.ogDescription);
  }

  if (head.ogImage) {
    updateOgMeta('og:image', head.ogImage);
  }

  // Update canonical link
  if (head.canonical) {
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', head.canonical);
  }
}
