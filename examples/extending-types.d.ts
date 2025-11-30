/**
 * Example: How to extend RenderContext in your application
 *
 * Save this file as: src/types/nestjs-react-ssr.d.ts (or any name)
 * Make sure it's included in your tsconfig.json
 *
 * This uses TypeScript's declaration merging to add custom properties
 * to the RenderContext interface from the @nestjs-react-ssr package.
 */

// Import the module to augment it
declare module '@nestjs-react-ssr' {
  /**
   * Extend the base RenderContext with app-specific properties.
   * These will be available throughout your entire application.
   */
  interface RenderContext {
    /**
     * Current authenticated user (from JWT, session, etc.)
     * Populated by authentication guard/middleware
     */
    user?: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
      roles: ('admin' | 'user' | 'moderator')[];
      verified: boolean;
    };

    /**
     * Multi-tenant organization/workspace context
     * Populated by tenant resolution middleware
     */
    tenant?: {
      id: string;
      name: string;
      slug: string;
      plan: 'free' | 'pro' | 'enterprise';
      limits: {
        users: number;
        storage: number;
      };
    };

    /**
     * User's preferred locale
     * Parsed from Accept-Language or user preferences
     */
    locale: string;

    /**
     * Resolved theme preference
     */
    theme?: 'light' | 'dark' | 'auto';

    /**
     * Feature flags for this user/tenant
     * Populated from feature flag service
     */
    features?: {
      betaFeatures?: boolean;
      aiAssistant?: boolean;
      analytics?: boolean;
      [key: string]: boolean | undefined;
    };

    /**
     * Analytics/tracking context
     */
    tracking?: {
      sessionId: string;
      deviceId?: string;
      referrer?: string;
    };

    /**
     * Geographic context (from IP geolocation)
     */
    geo?: {
      country: string;
      city?: string;
      timezone: string;
    };
  }
}

/**
 * IMPORTANT: This export statement is required to make this file a module.
 * Without it, TypeScript won't apply the declaration merging.
 */
export {};
