import type { PageData } from './component.interface';
import type { HeadData, RenderResponse } from './render-response.interface';

/**
 * Runtime brand marking a value as framework control data.
 *
 * Registered globally so two copies of the package in one dependency tree
 * still recognise each other's results. It exists to keep an ordinary domain
 * object that happens to have `html` or `json` properties from being read as
 * a representation envelope — it is a disambiguator, not a trust boundary.
 */
export const REPRESENTATION_BRAND: unique symbol = Symbol.for(
  '@nestjs-ssr/react:representation',
) as typeof REPRESENTATION_BRAND;

/** A value that may be produced lazily, so an unselected branch never runs. */
export type Lazy<T> = T | ((signal: AbortSignal) => T | Promise<T>);

/** The HTML representation of a rendered route. */
export interface PageRepresentation<T = PageData> {
  readonly [REPRESENTATION_BRAND]: 'page';
  /** Resolve the page value. Called only when HTML (or a segment) is selected. */
  resolve(signal?: AbortSignal): Promise<RenderResponse<T>>;
}

/** The JSON API representation of a rendered route. */
export interface ApiRepresentation<T = unknown> {
  readonly [REPRESENTATION_BRAND]: 'api';
  /** Media type this representation is offered as. */
  readonly mediaType: string;
  /** Resolve the API value. Called only when JSON is selected. */
  resolve(signal?: AbortSignal): Promise<T>;
}

/** An explicit multi-representation controller result. */
export interface RepresentationResult<THtml = PageData, TJson = unknown> {
  readonly [REPRESENTATION_BRAND]: 'representations';
  readonly html?: PageRepresentation<THtml>;
  readonly json?: ApiRepresentation<TJson>;
}

/** Any explicit result a `@Render()` controller may return. */
export type AnyRepresentationResult =
  | PageRepresentation<any>
  | ApiRepresentation<any>
  | RepresentationResult<any, any>;

/** Options accepted by {@link page}. */
export interface PageOptions<T> {
  props: T;
  head?: HeadData;
  layoutProps?: Record<string, any>;
}

async function resolveLazy<T>(
  value: Lazy<T>,
  signal?: AbortSignal,
): Promise<T> {
  return typeof value === 'function'
    ? await (value as (signal: AbortSignal) => T | Promise<T>)(
        signal ?? new AbortController().signal,
      )
    : value;
}

function isRenderResponseShape(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'props' in value;
}

/**
 * Declare the HTML representation of a route.
 *
 * The value is the same `{ props, head, layoutProps }` shape a controller can
 * return directly; passing a function defers building it until HTML is
 * actually the negotiated representation.
 *
 * @example
 * ```ts
 * return representations({
 *   html: page({ props: { user: toViewModel(user) } }),
 *   json: api(toPublicDto(user)),
 * });
 * ```
 */
export function page<T = PageData>(
  value: Lazy<PageOptions<T> | RenderResponse<T>>,
): PageRepresentation<T> {
  return {
    [REPRESENTATION_BRAND]: 'page',
    async resolve(signal?: AbortSignal): Promise<RenderResponse<T>> {
      const resolved = await resolveLazy(value, signal);
      // A page value is always a RenderResponse; wrapping a bare object keeps
      // `page(props)` working for callers who skip the `props` key.
      return isRenderResponseShape(resolved)
        ? resolved
        : { props: resolved as unknown as T };
    },
  };
}

/**
 * Declare the JSON representation of a route.
 *
 * The value is serialized as-is. It is projected and size-checked like every
 * other client-visible payload, but it is never merged with the page props —
 * an API DTO and a page view model stay independently typed.
 */
export function api<T>(
  value: Lazy<T>,
  options?: { mediaType?: string },
): ApiRepresentation<T> {
  return {
    [REPRESENTATION_BRAND]: 'api',
    mediaType: options?.mediaType ?? 'application/json',
    async resolve(signal?: AbortSignal): Promise<T> {
      return resolveLazy(value, signal);
    },
  };
}

/**
 * Offer several representations of one route from a single controller action.
 *
 * The framework negotiates which one to serve; only the selected branch is
 * resolved and serialized. Client-navigation segments are derived from the
 * `html` representation, never from `json`.
 */
export function representations<THtml = PageData, TJson = unknown>(value: {
  html?: PageRepresentation<THtml>;
  json?: ApiRepresentation<TJson>;
}): RepresentationResult<THtml, TJson> {
  return {
    [REPRESENTATION_BRAND]: 'representations',
    html: value.html,
    json: value.json,
  };
}

function brandOf(value: unknown): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<symbol, unknown>)[REPRESENTATION_BRAND]
    : undefined;
}

/** Whether a controller value is an explicit HTML representation. */
export function isPageRepresentation(
  value: unknown,
): value is PageRepresentation<any> {
  return brandOf(value) === 'page';
}

/** Whether a controller value is an explicit JSON representation. */
export function isApiRepresentation(
  value: unknown,
): value is ApiRepresentation<any> {
  return brandOf(value) === 'api';
}

/** Whether a controller value is an explicit multi-representation result. */
export function isRepresentationResult(
  value: unknown,
): value is RepresentationResult<any, any> {
  return brandOf(value) === 'representations';
}

/** Whether a controller value was produced by any representation factory. */
export function isExplicitRepresentation(
  value: unknown,
): value is AnyRepresentationResult {
  const brand = brandOf(value);
  return brand === 'page' || brand === 'api' || brand === 'representations';
}
