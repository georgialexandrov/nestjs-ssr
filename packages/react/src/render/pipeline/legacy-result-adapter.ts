import { Logger } from '@nestjs/common';
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
import { RenderConfigurationError } from './errors';

/** What a controller result offers, after adaptation. */
export interface AdaptedResult {
  html?: PageRepresentation<any>;
  json?: ApiRepresentation<any>;
  /**
   * A raw string returned by the controller. Deprecated: it bypasses the
   * render pipeline entirely, so nothing about it is projected, measured, or
   * policy-checked.
   */
  rawString?: string;
  /** True when the result came from an explicit representation factory. */
  explicit: boolean;
  /** Representations the result itself declares, for availability resolution. */
  declares: { html: boolean; json: boolean };
}

export interface AdaptOptions {
  /**
   * Whether legacy controller shapes are still accepted. False rejects raw
   * strings outright, as the next major will.
   */
  legacyCompatibility: boolean;
  /**
   * Whether a legacy controller result should additionally be offered as
   * JSON. True when JSON is enabled for the route and the controller did not
   * declare its own API representation — the page props are then the only
   * body available.
   */
  exposePropsAsJson: boolean;
  /**
   * Whether that exposure comes from the deprecated `jsonApi` alias rather
   * than an explicit representation policy. Drives migration guidance only.
   */
  viaDeprecatedFlag: boolean;
  /** Emit migration guidance. Development only. */
  deprecationLogger?: Pick<Logger, 'warn'>;
  /** Route name used in diagnostics. */
  routeLabel?: string;
}

/** Warnings already emitted, keyed by route, so a hot path logs once. */
const warned = new Set<string>();

/** Test seam: forget which deprecation warnings have been emitted. */
export function resetLegacyDiagnostics(): void {
  warned.clear();
}

function warnOnce(options: AdaptOptions, key: string, message: string): void {
  const id = `${options.routeLabel ?? 'route'}:${key}`;
  if (warned.has(id)) return;
  warned.add(id);
  options.deprecationLogger?.warn(message);
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
 * and — only while the deprecated `jsonApi` flag is on — the same props are
 * additionally offered as JSON, which is what that flag has always done.
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
    if (!options.legacyCompatibility) {
      throw new RenderConfigurationError(
        `${options.routeLabel ?? 'A @Render() route'} returned a raw string. ` +
          'Rendered routes return page data; for deliberate HTML passthrough use a route without @Render().',
      );
    }
    warnOnce(
      options,
      'raw-string',
      `${options.routeLabel ?? 'A @Render() route'} returned a raw string, which bypasses ` +
        'the render pipeline (no projection, no limits, no response policy). This is deprecated ' +
        'and will fail in the next major; use a route without @Render() for deliberate passthrough.',
    );
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
    if (options.viaDeprecatedFlag) {
      warnOnce(
        options,
        'json-api',
        `${options.routeLabel ?? 'A @Render() route'} serves its page props as the JSON API body ` +
          'because the deprecated `jsonApi` option is enabled. Page props are a view model, not an ' +
          'API contract: return representations({ html: page(...), json: api(dto) }) to give the ' +
          'JSON representation its own type.',
      );
    }
    adapted.json = api(renderResponse.props);
    adapted.declares.json = true;
  }

  return adapted;
}
