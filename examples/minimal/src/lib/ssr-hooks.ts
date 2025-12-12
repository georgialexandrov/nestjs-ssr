import { createSSRHooks, RenderContext } from '@nestjs-ssr/react';

/**
 * Extended render context with app-specific properties
 */
interface AppRenderContext extends RenderContext {
  /**
   * Authenticated user from req.user (Passport)
   */
  user?: {
    id: string;
    name: string;
    email: string;
  };

  /**
   * Theme from cookie (e.g., 'light' | 'dark')
   */
  theme?: string;

  /**
   * Feature flags for A/B testing or gradual rollouts
   */
  featureFlags?: Record<string, boolean>;
}

/**
 * Type-safe SSR hooks bound to AppRenderContext
 * Created once, used everywhere in the app with full type safety
 */
export const {
  usePageContext,
  useParams,
  useQuery,
  useUserAgent,
  useAcceptLanguage,
  useReferer,
  useRequest,
} = createSSRHooks<AppRenderContext>();

/**
 * Custom helper hook to access user
 */
export const useUser = () => usePageContext().user;

/**
 * Custom helper hook to access theme
 */
export const useTheme = () => usePageContext().theme || 'light';

/**
 * Custom helper hook to check feature flags
 */
export const useFeatureFlag = (flag: string) => {
  const { featureFlags } = usePageContext();
  return featureFlags?.[flag] ?? false;
};
