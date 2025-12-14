import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Request, Response } from 'express';
import type { ComponentType } from 'react';
import { RenderService } from './render.service';
import {
  RENDER_KEY,
  RENDER_OPTIONS_KEY,
} from '../decorators/react-render.decorator';
import { LAYOUT_KEY } from '../decorators/layout.decorator';
import type {
  RenderContext,
  RenderResponse,
  LayoutComponent,
  SegmentResponse,
} from '../interfaces/index';
import type { RenderOptions } from '../decorators/react-render.decorator';
import type { LayoutDecoratorOptions } from '../decorators/layout.decorator';

/**
 * Type guard to check if data is a RenderResponse
 */
function isRenderResponse(data: any): data is RenderResponse {
  return data && typeof data === 'object' && 'props' in data;
}

/**
 * Layout metadata structure
 */
interface LayoutMetadata {
  layout: LayoutComponent<any>;
  options?: LayoutDecoratorOptions;
}

@Injectable()
export class RenderInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private renderService: RenderService,
    @Optional() @Inject('ALLOWED_HEADERS') private allowedHeaders?: string[],
    @Optional() @Inject('ALLOWED_COOKIES') private allowedCookies?: string[],
  ) {}

  /**
   * Resolve the layout hierarchy for a given route
   * Hierarchy: Root Layout → Controller Layout → Method Layout → Page
   *
   * Props are merged in priority order:
   * 1. Static props from @Layout decorator (base)
   * 2. Static props from @Render decorator (override)
   * 3. Dynamic props from controller return (final override)
   */
  private async resolveLayoutChain(
    context: ExecutionContext,
    dynamicLayoutProps?: Record<string, any>,
  ): Promise<Array<{ layout: LayoutComponent<any>; props?: any }>> {
    const layouts: Array<{ layout: LayoutComponent<any>; props?: any }> = [];

    // 1. Get root layout (auto-discovered from conventional paths)
    const rootLayout = await this.renderService.getRootLayout();
    if (rootLayout) {
      layouts.push({
        layout: rootLayout,
        props: dynamicLayoutProps || {},
      });
    }

    // 2. Get controller-level layout from @Layout decorator
    const controllerLayoutMeta = this.reflector.get<LayoutMetadata>(
      LAYOUT_KEY,
      context.getClass(),
    );

    // 3. Get method-level layout options from @Render decorator
    const renderOptions = this.reflector.get<RenderOptions>(
      RENDER_OPTIONS_KEY,
      context.getHandler(),
    );

    // Resolve final layout based on method override behavior
    if (renderOptions?.layout === null) {
      // null = skip ALL layouts (including root)
      return [];
    } else if (renderOptions?.layout === false) {
      // false = skip controller layout, keep root only
      return layouts; // Only root layout (with dynamic props already merged)
    }

    // Add controller layout if it exists
    if (controllerLayoutMeta) {
      // Merge: static decorator props + dynamic runtime props
      const mergedProps = {
        ...(controllerLayoutMeta.options?.props || {}),
        ...(dynamicLayoutProps || {}),
      };

      layouts.push({
        layout: controllerLayoutMeta.layout,
        props: mergedProps,
      });
    }

    // Add method-level layout on top of controller layout (nested)
    if (renderOptions?.layout) {
      // Merge: static decorator props + dynamic runtime props
      const mergedProps = {
        ...(renderOptions.layoutProps || {}),
        ...(dynamicLayoutProps || {}),
      };

      layouts.push({
        layout: renderOptions.layout,
        props: mergedProps,
      });
    }

    return layouts;
  }

  /**
   * Detect request type based on headers.
   * - If X-Current-Layouts header is present, this is a segment request
   * - Only GET requests can be segments
   */
  private detectRequestType(request: Request): {
    type: 'full' | 'segment';
    currentLayouts?: string[];
  } {
    // Only GET requests can be segments
    if (request.method !== 'GET') {
      return { type: 'full' };
    }

    const layoutsHeader = request.headers['x-current-layouts'];

    if (layoutsHeader && typeof layoutsHeader === 'string') {
      const currentLayouts = layoutsHeader.split(',').map((s) => s.trim());
      return { type: 'segment', currentLayouts };
    }

    return { type: 'full' };
  }

  /**
   * Determine swap target by finding deepest common layout.
   * Returns null if no common ancestor (client should do full navigation).
   */
  private determineSwapTarget(
    currentLayouts: string[],
    targetLayouts: Array<{ layout: LayoutComponent<any>; props?: any }>,
  ): string | null {
    const targetNames = targetLayouts.map(
      (l) => l.layout.displayName || l.layout.name,
    );

    // Find deepest common layout (walk from root toward leaf)
    let commonLayout: string | null = null;
    for (
      let i = 0;
      i < Math.min(currentLayouts.length, targetNames.length);
      i++
    ) {
      if (currentLayouts[i] === targetNames[i]) {
        commonLayout = currentLayouts[i];
      } else {
        break; // Chains diverge here
      }
    }

    return commonLayout;
  }

  /**
   * Filter layouts to only include those below the swap target.
   * The swap target's outlet will contain the filtered layouts.
   */
  private filterLayoutsFromSwapTarget(
    layouts: Array<{ layout: LayoutComponent<any>; props?: any }>,
    swapTarget: string,
  ): Array<{ layout: LayoutComponent<any>; props?: any }> {
    const index = layouts.findIndex(
      (l) => (l.layout.displayName || l.layout.name) === swapTarget,
    );
    // Return layouts from swap target's children onward (exclude the swap target itself)
    return index >= 0 ? layouts.slice(index + 1) : layouts;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const viewPathOrComponent = this.reflector.get<string | ComponentType<any>>(
      RENDER_KEY,
      context.getHandler(),
    );

    if (!viewPathOrComponent) {
      // No @Render decorator, proceed normally
      return next.handle();
    }

    return next.handle().pipe(
      switchMap(async (data) => {
        const httpContext = context.switchToHttp();
        const request = httpContext.getRequest<Request>();
        const response = httpContext.getResponse<Response>();

        // If controller returned a string (HTML from previous render), pass it through
        // This prevents infinite rendering loops in string mode
        if (typeof data === 'string') {
          return data;
        }

        // Build base render context from request
        const renderContext: RenderContext = {
          url: request.url,
          path: request.path,
          query: request.query as Record<string, string | string[]>,
          params: request.params as Record<string, string>,
          method: request.method,
        };

        // Add allowed headers if configured
        if (this.allowedHeaders?.length) {
          for (const headerName of this.allowedHeaders) {
            const value = request.headers[headerName.toLowerCase()];
            if (value) {
              (renderContext as any)[headerName] = Array.isArray(value)
                ? value.join(', ')
                : value;
            }
          }
        }

        // Add allowed cookies if configured
        if (this.allowedCookies?.length && request.cookies) {
          const cookies: Record<string, string> = {};
          for (const cookieName of this.allowedCookies) {
            const value = request.cookies[cookieName];
            if (value !== undefined) {
              cookies[cookieName] = value;
            }
          }
          if (Object.keys(cookies).length > 0) {
            (renderContext as any).cookies = cookies;
          }
        }

        // Normalize data to RenderResponse structure
        // Auto-wrap flat objects: { foo: 1 } → { props: { foo: 1 } }
        const renderResponse: RenderResponse = isRenderResponse(data)
          ? data
          : { props: data };

        // Resolve layout hierarchy for this route with dynamic props
        const layoutChain = await this.resolveLayoutChain(
          context,
          renderResponse.layoutProps,
        );

        // Merge props with context and layouts
        const fullData = {
          data: renderResponse.props,
          __context: renderContext,
          __layouts: layoutChain,
        };

        // Check if this is a segment request (client-side navigation)
        const { type, currentLayouts } = this.detectRequestType(request);

        if (type === 'segment' && currentLayouts) {
          const swapTarget = this.determineSwapTarget(
            currentLayouts,
            layoutChain,
          );

          if (!swapTarget) {
            // No common ancestor - return signal for full navigation
            response.type('application/json');
            return { swapTarget: null } as Partial<SegmentResponse>;
          }

          const filteredLayouts = this.filterLayoutsFromSwapTarget(
            layoutChain,
            swapTarget,
          );
          const segmentData = { ...fullData, __layouts: filteredLayouts };
          const result = await this.renderService.renderSegment(
            viewPathOrComponent,
            segmentData,
            swapTarget,
            renderResponse.head,
          );
          response.type('application/json');
          return result;
        }

        try {
          // Render the React component with its layout chain
          // Pass response object for streaming mode support
          // Pass head data for template injection
          const html = await this.renderService.render(
            viewPathOrComponent as string,
            fullData,
            response,
            renderResponse.head,
          );

          // In streaming mode, render() returns void and handles response directly
          // In string mode, render() returns HTML string
          if (html !== undefined) {
            // String mode: Set content type and let NestJS handle sending the response
            response.type('text/html');
            return html;
          }

          // Streaming mode: Response already sent, return empty to prevent NestJS from sending again
          return;
        } catch (error) {
          // Re-throw error - let NestJS exception layer handle it
          throw error;
        }
      }),
    );
  }
}
