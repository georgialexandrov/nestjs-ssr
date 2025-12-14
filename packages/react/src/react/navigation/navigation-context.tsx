import React, { createContext, useContext, useState, useEffect } from 'react';
import { registerNavigationState } from './navigate';

type NavigationState = 'idle' | 'loading';

interface NavigationContextValue {
  state: NavigationState;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

/**
 * Provider component for navigation state.
 * Wrap your app with this to enable useNavigation hooks.
 */
export function NavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<NavigationState>('idle');

  useEffect(() => {
    // Register state setter so navigate() can update state
    registerNavigationState(setState);
  }, []);

  return (
    <NavigationContext.Provider value={{ state }}>
      {children}
    </NavigationContext.Provider>
  );
}

/**
 * Internal hook to access navigation context.
 * Returns default state ('idle') during SSR or if NavigationProvider is missing.
 */
export function useNavigationContext(): NavigationContextValue {
  const context = useContext(NavigationContext);
  // During SSR or if provider is missing, return default idle state
  if (!context) {
    return { state: 'idle' };
  }
  return context;
}
