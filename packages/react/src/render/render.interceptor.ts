import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { RenderService } from './render.service';
import {
  RENDER_KEY,
  RENDER_OPTIONS_KEY,
} from '../decorators/react-render.decorator';
import { LAYOUT_KEY } from '../decorators/layout.decorator';
import type { AnyComponent } from '../interfaces/component.interface';
import type {
  RenderContext,
  RenderResponse,
  LayoutComponent,
  ContextFactory,
  CspNonceFactory,
  SSRRequest,
  SSRResponse,
} from '../interfaces/index';
import type {
  RepresentationPolicy,
  ResolvedRepresentationPolicy,
} from '../interfaces/representation-policy.interface';
import type { RenderOptions } from '../decorators/react-render.decorator';
import type { LayoutDecoratorOptions } from '../decorators/layout.decorator';
import { getComponentName, getLayoutName } from './component-name.util';
import { isDevelopmentEnv } from './environment.util';
import {
  adaptControllerResult,
  type AdaptedResult,
} from './pipeline/legacy-result-adapter';
import {
  buildNotAcceptableBody,
  isNotAcceptable,
  negotiate,
  type NegotiatedRequest,
} from './pipeline/negotiator';
import { buildPublicContext } from './pipeline/public-context';
import { PublicPayloadProjector } from './pipeline/public-payload';
import { applyResponsePolicy } from './pipeline/response-policy';
import {
  setContentType,
  type WritableResponse,
} from './pipeline/response-writer';
import { RenderScope } from './pipeline/render-scope';
import { SEGMENT_SCHEMA_VERSION } from '../react/navigation/segment-schema';
import {
  defaultResolvedPolicy,
  resolveRoutePolicy,
} from './pipeline/representation-policy';
import {
  PayloadLimitError,
  PayloadSerializationError,
  RenderConfigurationError,
  RenderDeadlineError,
} from './pipeline/errors';

/** Layout metadata structure */
interface LayoutMetadata {
  layout: LayoutComponent<any>;
  options?: LayoutDecoratorOptions;
}

/**
 * Orchestrates the rendered-response pipeline.
 *
 * The interceptor itself decides nothing about media types, exposure, cache
 * policy, or adapter APIs. It sequences the stages that do:
 *
 *   route policy + request
 *     -> negotiate            (which representation)
 *     -> adapt                (what the controller returned)
 *     -> project              (what may reach the client)
 *     -> render               (HTML, JSON, or segment)
 *     -> response policy      (cache, security, Vary)
 *     -> write                (Express or Fastify)
 *
 * Each stage is independently testable, and only the writer touches the
 * response object.
 */
@Injectable()
export class RenderInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RenderInterceptor.name);
  private readonly isDevelopment = isDevelopmentEnv();

  constructor(
    private reflector: Reflector,
    private renderService: RenderService,
    @Optional() @Inject('ALLOWED_HEADERS') private allowedHeaders?: string[],
    @Optional() @Inject('ALLOWED_COOKIES') private allowedCookies?: string[],
    @Optional()
    @Inject('CONTEXT_FACTORY')
    private contextFactory?: ContextFactory,
    @Optional() @Inject('JSON_API') private jsonApiEnabled?: boolean,
    @Optional()
    @Inject('CLIENT_NAVIGATION')
    private clientNavigationEnabled?: boolean,
    @Optional()
    @Inject('CSP_NONCE')
    private cspNonceFactory?: CspNonceFactory,
    @Optional()
    @Inject('REPRESENTATION_POLICY')
    private modulePolicy?: ResolvedRepresentationPolicy,
    @Optional()
    @Inject('LEGACY_COMPATIBILITY')
    private legacyCompatibility?: boolean,
    @Optional()
    @Inject('LEGACY_JSON_API_ALIAS')
    private legacyJsonApiAlias?: boolean,
    @Optional()
    private readonly projector: PublicPayloadProjector = new PublicPayloadProjector(),
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

    // Add controller layout if it exists and is different from root layout
    if (controllerLayoutMeta?.layout) {
      // Skip if controller layout is the same as root layout (avoid duplicates)
      // Compare by name since dynamic imports create different references.
      // Anonymous root layouts never match - the fallback name is not identity.
      const rootLayoutName = rootLayout
        ? rootLayout.displayName || rootLayout.name
        : null;
      const isDuplicateOfRoot =
        !!rootLayoutName &&
        getComponentName(controllerLayoutMeta.layout) === rootLayoutName;

      if (!isDuplicateOfRoot) {
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
   * Determine swap target by finding deepest common layout.
   * Returns null if no common ancestor (client should do full navigation).
   */
  private determineSwapTarget(
    currentLayouts: string[],
    targetLayouts: Array<{ layout: LayoutComponent<any>; props?: any }>,
  ): string | null {
    const targetNames = targetLayouts.map((l) => getLayoutName(l.layout));

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
      (l) => getLayoutName(l.layout) === swapTarget,
    );
    // Return layouts from swap target's children onward (exclude the swap target itself)
    return index >= 0 ? layouts.slice(index + 1) : layouts;
  }

  /** Module policy, defaulted for tests and callers that construct directly. */
  private getModulePolicy(): ResolvedRepresentationPolicy {
    if (this.modulePolicy) return this.modulePolicy;
    const base = defaultResolvedPolicy();
    return { ...base, json: this.jsonApiEnabled ?? false };
  }

  /**
   * Resolve the policy for one route.
   *
   * Route options may tighten the module policy; `jsonApi` remains accepted
   * as the deprecated alias for `representation.json`.
   */
  private resolvePolicy(
    renderOptions: RenderOptions | undefined,
    routeLabel: string,
  ): ResolvedRepresentationPolicy {
    const routePolicy: RepresentationPolicy | undefined =
      renderOptions?.representation;

    return resolveRoutePolicy(this.getModulePolicy(), {
      policy: routePolicy,
      legacyJsonApi:
        routePolicy?.json === undefined ? renderOptions?.jsonApi : undefined,
      routeLabel,
    });
  }

  /**
   * Decide which representations this request may actually be served.
   *
   * An explicit controller result declares what exists; policy decides what
   * is allowed. A route that explicitly disables a representation always
   * wins — that is a deliberate exposure decision, not a default.
   */
  private resolveAvailability(
    policy: ResolvedRepresentationPolicy,
    adapted: AdaptedResult,
    renderOptions: RenderOptions | undefined,
  ): ResolvedRepresentationPolicy {
    const htmlDisabledByRoute = renderOptions?.representation?.html === false;
    const jsonDisabledByRoute =
      renderOptions?.representation?.json === false ||
      (renderOptions?.representation?.json === undefined &&
        renderOptions?.jsonApi === false);

    const html = adapted.declares.html && !htmlDisabledByRoute && policy.html;
    const json =
      adapted.declares.json &&
      !jsonDisabledByRoute &&
      // An explicit api() result enables JSON on its own; a legacy result
      // only declares JSON when policy already enabled it.
      (adapted.explicit || policy.json);

    let defaultRepresentation = policy.default;
    if (defaultRepresentation === 'json' && !json)
      defaultRepresentation = 'html';
    if (defaultRepresentation === 'html' && !html)
      defaultRepresentation = 'json';

    return { ...policy, html, json, default: defaultRepresentation };
  }

  /** Build the public render context: base fields, bags, app factory, projection. */
  private async buildContext(
    request: SSRRequest,
    policy: ResolvedRepresentationPolicy,
  ): Promise<RenderContext> {
    const context = buildPublicContext(request, {
      allowedHeaders: this.allowedHeaders,
      allowedCookies: this.allowedCookies,
      logger: this.logger,
      deprecationLogger: this.isDevelopment ? this.logger : undefined,
    });

    if (this.contextFactory) {
      const custom = await this.contextFactory({ req: request });
      if (custom) {
        // Application values are layered on top, but can never replace the
        // headers/cookies bags or the URL fields the framework guarantees.
        for (const [key, value] of Object.entries(custom)) {
          if (key === 'headers' || key === 'cookies') continue;
          (context as unknown as Record<string, unknown>)[key] = value;
        }
      }
    }

    return this.projector.projectContext(context, request, policy.limits);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // @Render only ever stores a component: its signature constrains the
    // argument to ComponentType, so there is no string-path form to handle.
    const viewComponent = this.reflector.get<AnyComponent | undefined>(
      RENDER_KEY,
      context.getHandler(),
    );

    if (!viewComponent) {
      // No @Render decorator, proceed normally
      return next.handle();
    }

    return next
      .handle()
      .pipe(
        switchMap(async (data: unknown) =>
          this.handleRenderedResponse(context, viewComponent, data),
        ),
      );
  }

  private async handleRenderedResponse(
    context: ExecutionContext,
    viewComponent: AnyComponent,
    data: unknown,
  ): Promise<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<SSRRequest>();
    const response = httpContext.getResponse<SSRResponse & WritableResponse>();

    const renderOptions = this.reflector.get<RenderOptions>(
      RENDER_OPTIONS_KEY,
      context.getHandler(),
    );
    const routeLabel = `${context.getClass()?.name ?? 'Controller'}.${
      context.getHandler()?.name ?? 'handler'
    }`;

    const policy = this.resolvePolicy(renderOptions, routeLabel);
    const clientNavigation = this.clientNavigationEnabled !== false;

    const adapted = adaptControllerResult(data, {
      legacyCompatibility: this.legacyCompatibility !== false,
      exposePropsAsJson: policy.json,
      viaDeprecatedFlag:
        this.legacyJsonApiAlias === true || renderOptions?.jsonApi === true,
      deprecationLogger: this.isDevelopment ? this.logger : undefined,
      routeLabel,
    });

    const available = this.resolveAvailability(policy, adapted, renderOptions);

    if (!available.html && !available.json) {
      throw new RenderConfigurationError(
        `${routeLabel} offers no representation: the controller result and the route policy disagree.`,
      );
    }

    const negotiation = negotiate(request, {
      policy: available,
      clientNavigation,
      jsonMediaType: adapted.json?.mediaType,
    });

    if (isNotAcceptable(negotiation)) {
      applyResponsePolicy(response, {
        policy: available,
        vary: negotiation.vary,
        kind: 'json',
      });
      throw new HttpException(
        buildNotAcceptableBody(negotiation.offered),
        HttpStatus.NOT_ACCEPTABLE,
      );
    }

    // The nonce is resolved before any header is written so the CSP the
    // policy stage emits and the scripts the renderer emits agree.
    const nonce = this.cspNonceFactory?.({ req: request });

    applyResponsePolicy(response, {
      policy: available,
      vary: negotiation.vary,
      kind: negotiation.kind,
      nonce,
    });

    // A raw string bypasses the pipeline entirely. It is deprecated for
    // exactly that reason; the adapter has already warned.
    if (adapted.rawString !== undefined) {
      setContentType(response, 'text/html');
      return adapted.rawString;
    }

    const scope = new RenderScope({
      deadlineMs: available.deadlineMs,
      request: request as unknown as {
        on?: (e: string, l: () => void) => void;
      },
    });

    try {
      if (negotiation.kind === 'json') {
        return await this.respondWithJson(
          response,
          adapted,
          available,
          negotiation,
          scope,
        );
      }

      return await this.respondWithHtml(
        context,
        viewComponent,
        request,
        response,
        adapted,
        available,
        negotiation,
        scope,
        nonce,
      );
    } catch (error) {
      throw this.toHttpError(error, scope);
    } finally {
      scope.dispose();
    }
  }

  /** Serve the JSON representation. */
  private async respondWithJson(
    response: WritableResponse,
    adapted: AdaptedResult,
    policy: ResolvedRepresentationPolicy,
    negotiation: NegotiatedRequest,
    scope: RenderScope,
  ): Promise<unknown> {
    if (!adapted.json) {
      throw new RenderConfigurationError(
        'JSON was negotiated but the controller result offers no JSON representation.',
      );
    }

    const value: unknown = await scope.run(
      Promise.resolve(adapted.json.resolve()),
    );
    const projected = this.projector.projectJson(value, policy.limits);

    setContentType(response, negotiation.mediaType);
    return projected;
  }

  /** Serve the HTML representation, or the segment derived from it. */
  private async respondWithHtml(
    context: ExecutionContext,
    viewComponent: AnyComponent,
    request: SSRRequest,
    response: SSRResponse & WritableResponse,
    adapted: AdaptedResult,
    policy: ResolvedRepresentationPolicy,
    negotiation: NegotiatedRequest,
    scope: RenderScope,
    nonce?: string,
  ): Promise<unknown> {
    if (!adapted.html) {
      throw new RenderConfigurationError(
        'HTML was negotiated but the controller result offers no HTML representation.',
      );
    }

    const pageValue = (await scope.run(
      Promise.resolve(adapted.html.resolve()),
    )) as RenderResponse;

    const renderContext = await this.buildContext(request, policy);
    const layoutChain = await this.resolveLayoutChain(
      context,
      pageValue.layoutProps,
    );

    if (negotiation.kind === 'segment') {
      return this.respondWithSegment(
        viewComponent,
        response,
        pageValue,
        renderContext,
        layoutChain,
        policy,
        negotiation,
        scope,
      );
    }

    const pageData = this.projector.projectPageData(
      pageValue.props,
      policy.limits,
    );

    const html = await scope.run(
      Promise.resolve(
        this.renderService.render(
          viewComponent,
          {
            data: pageData,
            __context: renderContext,
            __layouts: layoutChain,
          },
          response as unknown as SSRResponse,
          pageValue.head,
          nonce,
          scope.signal,
        ),
      ),
    );

    // Stream mode writes the response itself and resolves with undefined.
    if (html === undefined) {
      scope.markCommitted();
      return;
    }

    setContentType(response, 'text/html');
    return html;
  }

  /** Derive a navigation segment from the HTML representation. */
  private async respondWithSegment(
    viewComponent: AnyComponent,
    response: WritableResponse,
    pageValue: RenderResponse,
    renderContext: RenderContext,
    layoutChain: Array<{ layout: LayoutComponent<any>; props?: any }>,
    policy: ResolvedRepresentationPolicy,
    negotiation: NegotiatedRequest,
    scope: RenderScope,
  ): Promise<unknown> {
    const swapTarget = this.determineSwapTarget(
      negotiation.currentLayouts ?? [],
      layoutChain,
    );

    setContentType(response, negotiation.mediaType);

    if (!swapTarget) {
      // No common ancestor - tell the client to do a full navigation.
      return { v: SEGMENT_SCHEMA_VERSION, swapTarget: null };
    }

    const segmentData = this.projector.projectSegmentData(
      pageValue.props,
      policy.limits,
    );

    return scope.run(
      Promise.resolve(
        this.renderService.renderSegment(
          viewComponent,
          {
            data: segmentData,
            __context: renderContext,
            __layouts: this.filterLayoutsFromSwapTarget(
              layoutChain,
              swapTarget,
            ),
          },
          swapTarget,
          pageValue.head,
          scope.signal,
        ),
      ),
    );
  }

  /**
   * Map a pipeline failure onto an HTTP outcome.
   *
   * The distinction that matters is whether the response has been committed:
   * before commit a failure can still become a status code, after commit the
   * stream has already been aborted and there is nothing left to say.
   */
  private toHttpError(error: unknown, scope: RenderScope): unknown {
    if (error instanceof HttpException) return error;

    if (error instanceof RenderDeadlineError) {
      if (scope.isCommitted) return error;
      this.logger.error(`Render aborted (${error.reason}): ${error.message}`);
      return new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
          message: 'The page could not be rendered in time.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (
      error instanceof PayloadSerializationError ||
      error instanceof PayloadLimitError
    ) {
      // The message names the offending property path, never its value.
      this.logger.error(error.message);
      return new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'The response could not be serialized.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return error;
  }
}
