import type { SegmentResponse } from '../../interfaces/segment.interface';
import type { SerializedLayout } from '../../interfaces/component.interface';

/**
 * Version of the segment wire format.
 *
 * The client refuses a response whose version it does not understand rather
 * than guessing at a shape, so an old tab talking to a newly deployed server
 * falls back to a full navigation instead of applying a fragment it cannot
 * interpret.
 */
export const SEGMENT_SCHEMA_VERSION = 1;

/**
 * Largest segment payload the client will apply, in bytes.
 *
 * A navigation fragment is a page's worth of markup; anything far beyond that
 * is either a misconfigured route or a response the client should not be
 * pasting into the document.
 */
export const MAX_SEGMENT_BYTES = 4 * 1024 * 1024;

/** Same name shape the server validates in `X-Current-Layouts`. */
const VALID_NAME = /^[\p{L}\p{N}_.$-]{1,128}$/u;

/** Why a segment response was refused. */
export type SegmentRejection =
  'unsupported-version' | 'too-large' | 'malformed' | 'unknown-target';

export type SegmentValidation =
  | { ok: true; value: SegmentResponse }
  | { ok: false; reason: SegmentRejection; detail: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateLayouts(value: unknown): SerializedLayout[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const layouts: SerializedLayout[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) return null;
    const name = entry.name;
    if (typeof name !== 'string' || !VALID_NAME.test(name)) return null;
    if (entry.props !== undefined && !isPlainObject(entry.props)) return null;
    layouts.push({ name, props: entry.props });
  }
  return layouts;
}

/**
 * Validate a segment response before any of it reaches the DOM.
 *
 * The response is server-authored, but it arrives over the network as
 * untyped JSON: a proxy, a service worker, or a stale deployment can all
 * change what actually lands here. Everything the client is about to trust —
 * the swap target, the component name, the fragment size — is checked first,
 * and anything that fails becomes a full navigation.
 *
 * @param raw - Parsed JSON body of the segment response.
 * @param options.byteLength - Size of the response body, when known.
 * @param options.availableTargets - Layout names present in the current DOM.
 */
export function validateSegmentResponse(
  raw: unknown,
  options: { byteLength?: number; availableTargets?: string[] } = {},
): SegmentValidation {
  const maxBytes = MAX_SEGMENT_BYTES;
  if (options.byteLength !== undefined && options.byteLength > maxBytes) {
    return {
      ok: false,
      reason: 'too-large',
      detail: `segment response is ${options.byteLength} bytes, over the ${maxBytes} byte limit`,
    };
  }

  if (!isPlainObject(raw)) {
    return {
      ok: false,
      reason: 'malformed',
      detail: 'response is not an object',
    };
  }

  const version = raw.v;
  if (version !== undefined && version !== SEGMENT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: 'unsupported-version',
      detail: `segment schema version ${typeof version === 'number' ? version : typeof version} is not supported`,
    };
  }

  // A null swap target is the server telling the client to navigate fully.
  if (raw.swapTarget === null) {
    return { ok: true, value: { swapTarget: null } as SegmentResponse };
  }

  const swapTarget = raw.swapTarget;
  if (typeof swapTarget !== 'string' || !VALID_NAME.test(swapTarget)) {
    return {
      ok: false,
      reason: 'malformed',
      detail: 'swapTarget is not a layout name',
    };
  }

  if (
    options.availableTargets &&
    !options.availableTargets.includes(swapTarget)
  ) {
    return {
      ok: false,
      reason: 'unknown-target',
      detail: `swap target "${swapTarget}" is not in the current layout tree`,
    };
  }

  if (typeof raw.html !== 'string') {
    return { ok: false, reason: 'malformed', detail: 'html is not a string' };
  }
  if (raw.html.length > maxBytes) {
    return {
      ok: false,
      reason: 'too-large',
      detail: `segment html is ${raw.html.length} characters, over the ${maxBytes} limit`,
    };
  }

  const componentName = raw.componentName;
  if (typeof componentName !== 'string' || !VALID_NAME.test(componentName)) {
    return {
      ok: false,
      reason: 'malformed',
      detail: 'componentName is not a component name',
    };
  }

  if (!isPlainObject(raw.props)) {
    return { ok: false, reason: 'malformed', detail: 'props is not an object' };
  }

  if (raw.head !== undefined && !isPlainObject(raw.head)) {
    return { ok: false, reason: 'malformed', detail: 'head is not an object' };
  }

  if (raw.context !== undefined && !isPlainObject(raw.context)) {
    return {
      ok: false,
      reason: 'malformed',
      detail: 'context is not an object',
    };
  }

  const layouts = validateLayouts(raw.layouts);
  if (layouts === null) {
    return {
      ok: false,
      reason: 'malformed',
      detail: 'layouts is not a layout list',
    };
  }

  return {
    ok: true,
    value: {
      html: raw.html,
      head: raw.head,
      props: raw.props,
      swapTarget,
      componentName,
      context: raw.context as SegmentResponse['context'],
      layouts,
    },
  };
}
