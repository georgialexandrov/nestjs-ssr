// Navigation context and provider
export { NavigationProvider } from './navigation-context';

// Navigate function
export { navigate, registerNavigationState } from './navigate';
export type { NavigateOptions } from './navigate';

// Link component
export { Link } from './link';
export type { LinkProps } from './link';

// Same-origin validation shared by Link and navigate()
export { isSameOrigin, resolveSameOriginUrl } from './same-origin';

// Hooks
export {
  useNavigation,
  useNavigationState,
  useNavigate,
  useIsNavigating,
} from './hooks';
