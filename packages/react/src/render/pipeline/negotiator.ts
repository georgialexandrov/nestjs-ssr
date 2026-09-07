import type { ResolvedRepresentationPolicy } from '../../interfaces/representation-policy.interface';
import { isValidComponentName } from '../component-name.util';
import { matchOffer, parseAcceptHeader } from './media-type';

/**
 * Media type of a client-navigation segment response.
 *
 * Still `application/json`. A vendor type describes the payload better and is
 * where this is going, but changing it now would break anything asserting on
 * the current content type for no benefit this release delivers.
 */
export const SEGMENT_MEDIA_TYPE = 'application/json';

/** Media type of a rendered HTML page. */
export const HTML_MEDIA_TYPE = 'text/html';

/** Default media type of the JSON API representation. */
export const JSON_MEDIA_TYPE = 'application/json';

/** Header carrying the client's current layout chain. */
export const SEGMENT_HEADER = 'x-current-layouts';

/**
 * Maximum number of names accepted in the client-controlled
 * X-Current-Layouts header. Name shape is validated by
 * isValidComponentName, which lives next to the name generation logic.
 */
export const MAX_SEGMENT_LAYOUTS = 20;

/** Which representation the request resolved to. */
export type RepresentationKind = 'html' | 'json' | 'segment';

/** The request fields negotiation read, plus the outcome. */
export interface NegotiatedRequest {
  kind: RepresentationKind;
  /** Content type to write on the response. */
  mediaType: string;
  /** Layout chain from the client, present only for segment requests. */
  currentLayouts?: string[];
  /** Request headers that could have changed this outcome. */
  vary: string[];
}

/** Raised in place of a representation when nothing acceptable is offered. */
export interface NotAcceptableResult {
  kind: 'not-acceptable';
  /** Media types the route does offer, for the problem response. */
  offered: string[];
  vary: string[];
}

/** Minimal request shape negotiation needs, shared by Express and Fastify. */
export interface NegotiableRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface NegotiationOptions {
  policy: ResolvedRepresentationPolicy;
  /** Whether the module enables client-navigation segments. */
  clientNavigation: boolean;
  /** Media type the route's JSON representation declares, if any. */
  jsonMediaType?: string;
}

function headerValue(
  request: NegotiableRequest,
  name: string,
): string | undefined {
  const raw = request.headers?.[name];
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw[0];
  return undefined;
}

/**
 * Parse the client's layout chain from `X-Current-Layouts`.
 *
 * The header is client-controlled, so it is strictly validated: a bounded
 * number of names, each matching the shape of a component name. Anything else
 * returns null, which leaves the request to ordinary Accept negotiation
 * rather than failing it.
 */
export function parseSegmentHeader(
  request: NegotiableRequest,
): string[] | null {
  if (request.method !== 'GET') return null;

  const raw = headerValue(request, SEGMENT_HEADER);
  if (!raw) return null;

  const layouts = raw.split(',').map((name) => name.trim());
  if (layouts.length > MAX_SEGMENT_LAYOUTS) return null;
  if (!layouts.every((name) => isValidComponentName(name))) return null;

  return layouts;
}

/**
 * Choose the representation for a request.
 *
 * A valid segment request wins over Accept negotiation: it is the library's
 * own navigation protocol, and the client that sends the header also sends
 * whatever Accept its `fetch` default supplies.
 */
export function negotiate(
  request: NegotiableRequest,
  options: NegotiationOptions,
): NegotiatedRequest | NotAcceptableResult {
  const { policy, clientNavigation } = options;

  const vary = ['Accept'];
  if (clientNavigation) vary.push('X-Current-Layouts');

  if (clientNavigation && policy.html) {
    const currentLayouts = parseSegmentHeader(request);
    if (currentLayouts) {
      return {
        kind: 'segment',
        mediaType: SEGMENT_MEDIA_TYPE,
        currentLayouts,
        vary,
      };
    }
  }

  const jsonMediaType = options.jsonMediaType ?? JSON_MEDIA_TYPE;
  const jsonMediaTypes =
    jsonMediaType === JSON_MEDIA_TYPE
      ? [JSON_MEDIA_TYPE]
      : [jsonMediaType, JSON_MEDIA_TYPE];

  const ranges = parseAcceptHeader(request.headers?.accept);

  // Selection, deliberately conservative for this release.
  //
  // The parser understands qualities, wildcards, exclusions and structured
  // suffixes, and `selectMediaType` ranks with all of it. Ranking that way
  // changes what an existing client is served — `text/html, application/json`
  // resolves to HTML under the correct rules and resolved to JSON under the
  // substring check this replaces — so it is a documented default change and
  // rides with the next breaking release.
  //
  // What the parser is used for here is the part that cannot break anyone:
  // deciding whether the client *actually asked for JSON*, rather than
  // whether "application/json" happened to appear somewhere in the header.
  // A wildcard is not asking: `*` `/` `*` and a missing header mean "whatever you
  // have", which is what a browser sends and has always meant HTML.
  const askedForJson = jsonMediaTypes.some((mediaType) => {
    const match = matchOffer(ranges, mediaType);
    // 3 = named exactly, 2 = named through a structured `+json` suffix.
    // 1 and 0 are `type/*` and `*` `/` `*`, which express no preference.
    return match !== null && match.specificity >= 2;
  });

  if (askedForJson) {
    if (policy.json) {
      const mediaType =
        jsonMediaTypes.find(
          (candidate) => (matchOffer(ranges, candidate)?.specificity ?? 0) >= 2,
        ) ?? jsonMediaType;
      return { kind: 'json', mediaType, vary };
    }
    // The client named a representation this route does not offer. This is
    // the one case that has always been a 406.
    return { kind: 'not-acceptable', offered: [HTML_MEDIA_TYPE], vary };
  }

  // Routes without an HTML representation are new in this release, so there
  // is no prior behaviour to preserve. A client that explicitly asked for HTML
  // is told the route cannot produce it.
  const askedForHtml =
    (matchOffer(ranges, HTML_MEDIA_TYPE)?.specificity ?? 0) >= 2;

  if (!policy.html && askedForHtml) {
    return {
      kind: 'not-acceptable',
      offered: policy.json ? [jsonMediaType] : [],
      vary,
    };
  }

  // A route that declares JSON as its default is new configuration, so
  // honouring it cannot change what an existing application serves.
  if (policy.default === 'json' && policy.json) {
    return { kind: 'json', mediaType: jsonMediaType, vary };
  }

  // No explicit JSON request. As before, the route serves its page rather
  // than refusing an Accept header it cannot satisfy exactly — a client that
  // asks for `image/png` still gets HTML, not a 406.
  if (policy.html) {
    return { kind: 'html', mediaType: HTML_MEDIA_TYPE, vary };
  }

  if (policy.json) {
    return { kind: 'json', mediaType: jsonMediaType, vary };
  }

  return { kind: 'not-acceptable', offered: [], vary };
}

/** Whether a negotiation outcome is the 406 case. */
export function isNotAcceptable(
  result: NegotiatedRequest | NotAcceptableResult,
): result is NotAcceptableResult {
  return (result as NotAcceptableResult).kind === 'not-acceptable';
}

/**
 * Body of the 406 response.
 *
 * Unchanged from previous releases, because the exact shape is documented and
 * applications may be asserting on it. Naming the acceptable media types is a
 * better answer and lands with the next breaking release. It never contains
 * controller data — that representation was not selected and may be private.
 */
export function buildNotAcceptableBody(offered?: readonly string[]): {
  error: string;
  message: string;
} {
  // The acceptable media types are deliberately not named yet; doing so
  // changes a documented response body. The parameter stays in the signature
  // because the next breaking release uses it.
  void offered;

  return {
    error: 'Not Acceptable',
    message: 'JSON response not available for this route',
  };
}
