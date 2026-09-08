import type { ResolvedRepresentationPolicy } from '../../interfaces/representation-policy.interface';
import { isValidComponentName } from '../component-name.util';
import { parseAcceptHeader, selectMediaType } from './media-type';

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
  /** Existing controller shapes retain their historical Accept behavior. */
  mode?: 'legacy' | 'standard';
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

  if (options.mode === 'legacy') {
    const accept = request.headers?.accept;
    const askedForJson =
      typeof accept === 'string' && accept.includes(JSON_MEDIA_TYPE);

    if (askedForJson) {
      return policy.json
        ? { kind: 'json', mediaType: JSON_MEDIA_TYPE, vary }
        : { kind: 'not-acceptable', offered: [HTML_MEDIA_TYPE], vary };
    }

    if (policy.html) {
      return { kind: 'html', mediaType: HTML_MEDIA_TYPE, vary };
    }
    if (policy.json) {
      return { kind: 'json', mediaType: jsonMediaType, vary };
    }
    return { kind: 'not-acceptable', offered: [], vary };
  }

  const ranges = parseAcceptHeader(request.headers?.accept);

  const offers: string[] = [];
  const addHtml = () => {
    if (policy.html && !offers.includes(HTML_MEDIA_TYPE)) {
      offers.push(HTML_MEDIA_TYPE);
    }
  };
  const addJson = () => {
    if (!policy.json) return;
    for (const mediaType of jsonMediaTypes) {
      if (!offers.includes(mediaType)) offers.push(mediaType);
    }
  };

  if (policy.default === 'json') {
    addJson();
    addHtml();
  } else {
    addHtml();
    addJson();
  }

  const selected = selectMediaType(ranges, offers);
  if (!selected) return { kind: 'not-acceptable', offered: offers, vary };

  return selected.mediaType === HTML_MEDIA_TYPE
    ? { kind: 'html', mediaType: HTML_MEDIA_TYPE, vary }
    : { kind: 'json', mediaType: selected.mediaType, vary };
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
 * Legacy controller shapes retain the documented response body. Explicit
 * representation results can safely name their offers because they are a new
 * API with no older wire contract. Neither body contains controller data.
 */
export function buildNotAcceptableBody(
  offered: readonly string[] = [],
  options: { legacy?: boolean } = {},
): { error: string; message: string; acceptable?: readonly string[] } {
  if (options.legacy) {
    return {
      error: 'Not Acceptable',
      message: 'JSON response not available for this route',
    };
  }

  return {
    error: 'Not Acceptable',
    message: 'No acceptable representation is available for this route',
    acceptable: offered,
  };
}
