import { useCallback } from 'react';
import { useNavigationContext } from './navigation-context';
import { navigate as navigateFn, NavigateOptions } from './navigate';

/**
 * Hook to access navigation state and navigate function.
 */
export function useNavigation() {
  const { state } = useNavigationContext();
  return {
    state,
    navigate: navigateFn,
  };
}

/**
 * Hook to get only the navigation state.
 * Returns 'idle' or 'loading'.
 */
export function useNavigationState(): 'idle' | 'loading' {
  return useNavigationContext().state;
}

/**
 * Hook that returns the navigate function for programmatic navigation.
 */
export function useNavigate(): (
  url: string,
  options?: NavigateOptions,
) => Promise<void> {
  return useCallback(navigateFn, []);
}

/**
 * Hook to check if navigation is in progress.
 */
export function useIsNavigating(): boolean {
  return useNavigationContext().state === 'loading';
}
