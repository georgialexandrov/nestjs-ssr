import React, { Suspense, lazy, ComponentType } from 'react';

/**
 * Lazy load wrapper for non-critical components
 *
 * Use this for components that:
 * - Are not needed for initial render (modals, tooltips, heavy widgets)
 * - Appear after user interaction
 * - Are not part of SSR (client-only)
 *
 * Example:
 * ```tsx
 * const HeavyChart = lazyLoad(() => import('./heavy-chart'));
 *
 * function Dashboard() {
 *   return (
 *     <div>
 *       <h1>Dashboard</h1>
 *       <HeavyChart data={data} />
 *     </div>
 *   );
 * }
 * ```
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback: React.ReactNode = <div>Loading...</div>,
) {
  const LazyComponent = lazy(importFunc);

  return function LazyLoadedComponent(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

/**
 * Client-only lazy loader - prevents SSR hydration mismatches
 *
 * Use this for components that should only render on the client:
 * - Browser-specific features (window, navigator APIs)
 * - Third-party widgets that don't support SSR
 *
 * Example:
 * ```tsx
 * const BrowserOnlyMap = clientOnly(() => import('./map-component'));
 * ```
 */
export function clientOnly<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback: React.ReactNode = null,
) {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return () => <>{fallback}</>;
  }

  return lazyLoad(importFunc, fallback);
}
