/**
 * Example: Custom Render Interceptor
 *
 * This file shows how to extend the base RenderInterceptor from the package
 * to populate your custom context properties.
 *
 * The base interceptor handles the core rendering logic.
 * You just need to override the `buildContext` method to add your properties.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Module,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Request } from 'express';
import type { RenderContext } from '@nestjs-react-ssr';
import {
  RenderService,
  RenderInterceptor as BaseRenderInterceptor,
} from '@nestjs-react-ssr';

/**
 * Extended Express Request with custom properties
 * (populated by your auth guards, middleware, etc.)
 */
interface AppRequest extends Request {
  // Populated by Passport JWT strategy
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    roles: string[];
    verified: boolean;
  };

  // Populated by tenant resolution middleware
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

  // Populated by locale middleware
  locale?: string;

  // Populated by feature flag service
  features?: Record<string, boolean>;

  // Populated by tracking middleware
  sessionId?: string;
}

// =============================================================================
// APPROACH 1: Extend Base Interceptor (Recommended)
// =============================================================================

/**
 * Custom render interceptor that extends the base interceptor.
 * Override `buildContext` to add your custom properties.
 */
@Injectable()
export class AppRenderInterceptor extends BaseRenderInterceptor {
  constructor(
    reflector: Reflector,
    renderService: RenderService,
  ) {
    super(reflector, renderService);
  }

  /**
   * Override this method to build your custom context.
   * The base interceptor will call this method to get the context.
   */
  protected buildContext(request: AppRequest): RenderContext {
    // Get base context (url, path, params, query, headers)
    const baseContext = super.buildContext(request);

    // Add your custom properties
    // TypeScript knows about these thanks to declaration merging!
    return {
      ...baseContext,
      // Authentication
      user: request.user
        ? {
            id: request.user.id,
            name: request.user.name,
            email: request.user.email,
            avatar: request.user.avatar,
            roles: request.user.roles as ('admin' | 'user' | 'moderator')[],
            verified: request.user.verified,
          }
        : undefined,

      // Multi-tenancy
      tenant: request.tenant,

      // Localization
      locale: request.locale || this.parseLocale(request) || 'en',

      // Theme preference
      theme: this.getThemePreference(request),

      // Feature flags
      features: request.features || {},

      // Tracking
      tracking: {
        sessionId: request.sessionId || this.generateSessionId(),
        deviceId: request.cookies?.deviceId,
        referrer: request.headers.referer,
      },

      // Geographic context (from IP geolocation service)
      geo: this.getGeoContext(request),
    };
  }

  /**
   * Helper: Parse locale from Accept-Language header
   */
  private parseLocale(request: Request): string | undefined {
    const acceptLanguage = request.headers['accept-language'];
    if (!acceptLanguage) return undefined;

    // Simple parsing: "en-US,en;q=0.9,es;q=0.8" -> "en"
    const primaryLocale = acceptLanguage.split(',')[0]?.split('-')[0];
    return primaryLocale;
  }

  /**
   * Helper: Get theme preference from cookie or user settings
   */
  private getThemePreference(request: AppRequest): 'light' | 'dark' | 'auto' {
    // Check cookie first
    const themeCookie = request.cookies?.theme;
    if (themeCookie === 'light' || themeCookie === 'dark') {
      return themeCookie;
    }

    // Check user preference
    // (would need to add to user type)
    // if (request.user?.preferences?.theme) {
    //   return request.user.preferences.theme;
    // }

    return 'auto';
  }

  /**
   * Helper: Get geographic context from IP
   */
  private getGeoContext(request: Request) {
    // In production, use a geolocation service
    // For example: MaxMind GeoIP, ipapi.co, etc.

    // For now, return undefined or mock data
    const ip = request.ip || request.socket.remoteAddress;

    // Example: Call your geolocation service
    // const geo = await this.geoService.lookup(ip);
    // return geo;

    // For development, return undefined
    return undefined;
  }

  /**
   * Helper: Generate session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// APPROACH 2: Composition with Context Builder Service (Alternative)
// =============================================================================

/**
 * Context builder service that encapsulates all context building logic.
 * This is useful if you want to reuse context building elsewhere.
 */
@Injectable()
export class ContextBuilderService {
  constructor(
    // Inject any services you need
    // private readonly featureFlagService: FeatureFlagService,
    // private readonly geoService: GeoLocationService,
  ) {}

  /**
   * Build the full render context from the request.
   */
  async buildContext(request: AppRequest): Promise<RenderContext> {
    // Base properties
    const context: RenderContext = {
      url: request.url,
      path: request.path,
      query: request.query as Record<string, string | string[]>,
      params: request.params as Record<string, string>,
      userAgent: request.headers['user-agent'],
      acceptLanguage: request.headers['accept-language'],
      referer: request.headers.referer,
    };

    // Add user if authenticated
    if (request.user) {
      context.user = {
        id: request.user.id,
        name: request.user.name,
        email: request.user.email,
        avatar: request.user.avatar,
        roles: request.user.roles as ('admin' | 'user' | 'moderator')[],
        verified: request.user.verified,
      };
    }

    // Add tenant if in multi-tenant context
    if (request.tenant) {
      context.tenant = request.tenant;
    }

    // Locale
    context.locale = request.locale || this.parseLocale(request) || 'en';

    // Theme
    context.theme = this.getThemePreference(request);

    // Feature flags (could be async)
    context.features = await this.getFeatureFlags(request);

    // Tracking
    context.tracking = {
      sessionId: request.sessionId || this.generateSessionId(),
      deviceId: request.cookies?.deviceId,
      referrer: request.headers.referer,
    };

    // Geographic context (async)
    context.geo = await this.getGeoContext(request);

    return context;
  }

  private parseLocale(request: Request): string | undefined {
    const acceptLanguage = request.headers['accept-language'];
    if (!acceptLanguage) return undefined;
    return acceptLanguage.split(',')[0]?.split('-')[0];
  }

  private getThemePreference(request: AppRequest): 'light' | 'dark' | 'auto' {
    return (request.cookies?.theme as any) || 'auto';
  }

  private async getFeatureFlags(request: AppRequest): Promise<Record<string, boolean>> {
    // In production, call feature flag service
    // return await this.featureFlagService.getFlags(request.user?.id, request.tenant?.id);

    return request.features || {};
  }

  private async getGeoContext(request: Request) {
    // In production, call geolocation service
    // const ip = request.ip || request.socket.remoteAddress;
    // return await this.geoService.lookup(ip);

    return undefined;
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Interceptor using the ContextBuilderService
 */
@Injectable()
export class AppRenderInterceptorWithService extends BaseRenderInterceptor {
  constructor(
    reflector: Reflector,
    renderService: RenderService,
    private readonly contextBuilder: ContextBuilderService,
  ) {
    super(reflector, renderService);
  }

  protected async buildContext(request: AppRequest): Promise<RenderContext> {
    // Delegate to the context builder service
    return await this.contextBuilder.buildContext(request);
  }
}

// =============================================================================
// APPROACH 3: Standalone Interceptor (If not extending base)
// =============================================================================

/**
 * Completely custom interceptor without extending the base.
 * Use this if you need full control over the rendering logic.
 */
@Injectable()
export class StandaloneAppRenderInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private renderService: RenderService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const viewPath = this.reflector.get<string>(
      'REACT_RENDER_KEY',
      context.getHandler(),
    );

    if (!viewPath) {
      return next.handle();
    }

    return next.handle().pipe(
      switchMap(async (data) => {
        const httpContext = context.switchToHttp();
        const request = httpContext.getRequest<AppRequest>();
        const response = httpContext.getResponse();

        try {
          // Build your custom context
          const renderContext: RenderContext = {
            url: request.url,
            path: request.path,
            query: request.query as Record<string, string | string[]>,
            params: request.params as Record<string, string>,
            userAgent: request.headers['user-agent'],
            acceptLanguage: request.headers['accept-language'],
            referer: request.headers.referer,

            // Custom properties
            user: request.user,
            tenant: request.tenant,
            locale: request.locale || 'en',
            theme: (request.cookies?.theme as any) || 'auto',
            features: request.features || {},
            tracking: {
              sessionId: request.sessionId || `sess_${Date.now()}`,
              deviceId: request.cookies?.deviceId,
              referrer: request.headers.referer,
            },
          };

          // Merge with controller data
          const fullData = {
            data,
            __context: renderContext,
          };

          // Render
          const html = await this.renderService.render(viewPath, fullData);

          // Send response
          response.type('text/html');
          response.send(html);
        } catch (error) {
          console.error('Render error:', error);
          response.status(500).send('Internal Server Error');
        }

        return;
      }),
    );
  }
}

// =============================================================================
// Module Registration
// =============================================================================

/**
 * Example module showing how to register your custom interceptor
 */
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  providers: [
    // Option 1: Use extended interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: AppRenderInterceptor,
    },

    // Option 2: Use with context builder service
    // ContextBuilderService,
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: AppRenderInterceptorWithService,
    // },

    // Option 3: Use standalone
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: StandaloneAppRenderInterceptor,
    // },
  ],
})
export class AppRenderModule {}
