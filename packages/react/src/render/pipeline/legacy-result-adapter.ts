import type { PageData } from '../../interfaces/component.interface';
import type { RenderResponse } from '../../interfaces/render-response.interface';
import {
  api,
  isApiRepresentation,
  isExplicitRepresentation,
  isPageRepresentation,
  isRepresentationResult,
  page,
  type ApiRepresentation,
  type PageRepresentation,
} from '../../interfaces/representation.interface';

/** What a controller result offers, after adaptation. */
export interface AdaptedResult {
  html?: PageRepresentation<any>;
  json?: ApiRepresentation<any>;
  /**
   * A raw string returned by the controller. It preserves the established
   * passthrough contract and therefore bypasses projection and rendering.
   */
  rawString?: string;
  /** True when the result came from an explicit representation factory. */
  explicit: boolean;
  /** Representations the result itself declares, for availability resolution. */
  declares: { html: boolean; json: boolean };
}

export interface AdaptOptions {
  /**
   * Whether an existing controller result should additionally be offered as
   * JSON. True when JSON is enabled for the route and the controller did not
   * declare its own API representation — the page props are then the only
   * body available.
   */
  exposePropsAsJson: boolean;
}

function isRenderResponse(value: unknown): value is RenderResponse {
  return typeof value === 'object' && value !== null && 'props' in value;
}

/**
 * Coerce a controller's return value into a prop set.
 *
 * A `@Render` handler is expected to return the page's props object. Anything
 * else — a number, null — has no meaningful prop shape, so it becomes an
 * empty set rather than being spread onto the component.
 */
function toPageData(value: unknown): PageData {
  return typeof value === 'object' && value !== null ? (value as PageData) : {};
}

/**
 * Bring every accepted controller return shape onto the new pipeline.
 *
 * Explicit `page()`/`api()`/`representations()` results pass through
 * unchanged. Plain props and `RenderResponse` become an HTML representation,
 * and — when JSON is enabled for the route — the same props are additionally
 * offered as JSON, which preserves the established `jsonApi` contract.
 */
export function adaptControllerResult(
  value: unknown,
  options: AdaptOptions,
): AdaptedResult {
  if (isExplicitRepresentation(value)) {
    if (isRepresentationResult(value)) {
      return {
        html: value.html,
        json: value.json,
        explicit: true,
        declares: { html: !!value.html, json: !!value.json },
      };
    }
    if (isPageRepresentation(value)) {
      return {
        html: value,
        explicit: true,
        declares: { html: true, json: false },
      };
    }
    if (isApiRepresentation(value)) {
      return {
        json: value,
        explicit: true,
        declares: { html: false, json: true },
      };
    }
  }

  if (typeof value === 'string') {
    return {
      rawString: value,
      explicit: false,
      declares: { html: true, json: false },
    };
  }

  const renderResponse: RenderResponse = isRenderResponse(value)
    ? value
    : { props: toPageData(value) };

  const adapted: AdaptedResult = {
    html: page(renderResponse),
    explicit: false,
    declares: { html: true, json: false },
  };

  if (options.exposePropsAsJson) {
    adapted.json = api(renderResponse.props);
    adapted.declares.json = true;
  }

  return adapted;
}
