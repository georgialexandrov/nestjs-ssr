/**
 * Standards-aware Accept header parsing and media-type matching.
 *
 * Replaces the previous `accept.includes('application/json')` check, which
 * chose JSON even when the client ranked HTML higher, ignored `q=0`
 * exclusions, and could be triggered by an unrelated substring.
 *
 * Parsing is deliberately tolerant (RFC 9110 §12.5.1): a malformed media
 * range is dropped rather than failing the request, so a broken proxy header
 * degrades to "nothing acceptable" (406) instead of a 400.
 */

/** A single parsed entry of an Accept header. */
export interface MediaRange {
  /** Primary type, lowercased. `*` for a wildcard. */
  type: string;
  /** Subtype, lowercased. `*` for a wildcard. */
  subtype: string;
  /** Structured suffix without the `+` (e.g. `json` for `application/ld+json`). */
  suffix: string | null;
  /** Quality weight in [0, 1]. Defaults to 1. */
  quality: number;
  /** Media parameters that appear before `q` (lowercased names). */
  parameters: Record<string, string>;
  /** Position in the header, used as the final tiebreaker. */
  order: number;
}

/** How well a media range matched a concrete media type. */
export interface MediaTypeMatch {
  /** The offered media type that matched. */
  mediaType: string;
  /** Quality of the matching range. */
  quality: number;
  /** 3 = exact type/subtype, 2 = structured suffix, 1 = type/*, 0 = */
  specificity: number;
  /** Header position of the matching range. */
  order: number;
}

// token = 1*tchar (RFC 9110 §5.6.2)
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

function isToken(value: string): boolean {
  return TOKEN.test(value);
}

/**
 * Parse a `q` value. Returns null when the value is not a valid qvalue, so
 * the caller can drop the range rather than silently treating it as 1.
 */
function parseQuality(raw: string): number | null {
  if (!/^(0(\.\d{0,3})?|1(\.0{0,3})?)$/.test(raw)) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Split on a delimiter, ignoring delimiters inside a quoted string.
 * Accept parameters may carry quoted values (`;version="1,2"`).
 */
function splitUnquoted(value: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quoted = false;
  let escaped = false;

  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && quoted) {
      current += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      current += char;
      continue;
    }
    if (char === delimiter && !quoted) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  parts.push(current);
  return parts;
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return value;
}

/**
 * Maximum number of media ranges parsed from one Accept header. A header
 * beyond this size is truncated rather than rejected: negotiation only needs
 * the ranges that can match one of a handful of offers, and an unbounded loop
 * over a hostile header is a cheap denial-of-service vector.
 */
export const MAX_MEDIA_RANGES = 50;

/** Longest Accept header considered. Longer headers are truncated. */
export const MAX_ACCEPT_LENGTH = 8 * 1024;

/**
 * Parse an Accept header into media ranges, dropping malformed entries.
 *
 * An absent or empty header yields a single `*` `/` `*` range, matching the RFC's
 * "client accepts anything" default.
 */
export function parseAcceptHeader(
  header: string | string[] | undefined | null,
): MediaRange[] {
  const value = Array.isArray(header) ? header.join(',') : header;

  if (value == null || value.trim() === '') {
    return [
      {
        type: '*',
        subtype: '*',
        suffix: null,
        quality: 1,
        parameters: {},
        order: 0,
      },
    ];
  }

  const ranges: MediaRange[] = [];
  const source =
    value.length > MAX_ACCEPT_LENGTH
      ? value.slice(0, MAX_ACCEPT_LENGTH)
      : value;

  const entries = splitUnquoted(source, ',');
  for (let index = 0; index < entries.length; index++) {
    if (ranges.length >= MAX_MEDIA_RANGES) break;
    const range = parseMediaRange(entries[index], ranges.length);
    if (range) ranges.push(range);
  }

  return ranges;
}

function parseMediaRange(entry: string, order: number): MediaRange | null {
  const segments = splitUnquoted(entry, ';');
  const mediaType = segments[0]?.trim().toLowerCase();
  if (!mediaType) return null;

  const slash = mediaType.indexOf('/');
  if (slash <= 0 || slash === mediaType.length - 1) return null;

  const type = mediaType.slice(0, slash);
  const subtype = mediaType.slice(slash + 1);

  if (type !== '*' && !isToken(type)) return null;
  if (subtype !== '*' && !isToken(subtype)) return null;
  // `*/json` is not a valid media range: a wildcard type forces a wildcard subtype.
  if (type === '*' && subtype !== '*') return null;

  const plus = subtype.lastIndexOf('+');
  const suffix = plus > 0 ? subtype.slice(plus + 1) : null;

  let quality = 1;
  const parameters: Record<string, string> = {};
  let seenQ = false;

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i].trim();
    if (!segment) continue;

    const eq = segment.indexOf('=');
    const name = (eq === -1 ? segment : segment.slice(0, eq))
      .trim()
      .toLowerCase();
    const rawValue = eq === -1 ? '' : segment.slice(eq + 1).trim();

    if (name === 'q' && !seenQ) {
      const parsed = parseQuality(unquote(rawValue));
      // A malformed q makes the whole range unusable; dropping it is safer
      // than guessing a weight the client did not ask for.
      if (parsed === null) return null;
      quality = parsed;
      seenQ = true;
      continue;
    }

    // Everything after `q` is an Accept extension parameter, not a media
    // parameter, and does not participate in matching.
    if (seenQ) continue;
    if (!isToken(name)) return null;
    parameters[name] = unquote(rawValue);
  }

  return { type, subtype, suffix, quality, parameters, order };
}

/** Parse a concrete media type (an offer), without quality handling. */
export function parseMediaType(
  mediaType: string,
): { type: string; subtype: string; suffix: string | null } | null {
  const normalized = mediaType.trim().toLowerCase();
  const base = normalized.split(';')[0].trim();
  const slash = base.indexOf('/');
  if (slash <= 0 || slash === base.length - 1) return null;

  const type = base.slice(0, slash);
  const subtype = base.slice(slash + 1);
  if (!isToken(type) || !isToken(subtype)) return null;

  const plus = subtype.lastIndexOf('+');
  return { type, subtype, suffix: plus > 0 ? subtype.slice(plus + 1) : null };
}

/**
 * Score how specifically `range` matches `mediaType`.
 * Returns null when the range does not match at all.
 *
 * Specificity ordering follows RFC 9110 §12.5.1 precedence, extended with a
 * rung for structured suffixes so `application/json` beats
 * `application/*+json` for an `application/json` offer.
 */
export function matchSpecificity(
  range: MediaRange,
  mediaType: string,
): number | null {
  const offer = parseMediaType(mediaType);
  if (!offer) return null;

  if (range.type === '*' && range.subtype === '*') return 0;
  if (range.type !== offer.type) return null;
  if (range.subtype === '*') return 1;
  if (range.subtype === offer.subtype) return 3;

  // `application/*+json` matches any structured-suffix media type with that
  // suffix, and also the base `application/json` media type.
  if (range.subtype.startsWith('*+') && range.suffix) {
    if (offer.suffix === range.suffix || offer.subtype === range.suffix) {
      return 2;
    }
  }

  return null;
}

/**
 * Pick the best media range for a single offer.
 * Returns null when the offer is not acceptable (no match, or `q=0`).
 */
export function matchOffer(
  ranges: MediaRange[],
  mediaType: string,
): MediaTypeMatch | null {
  let best: MediaTypeMatch | null = null;

  for (const range of ranges) {
    const specificity = matchSpecificity(range, mediaType);
    if (specificity === null) continue;

    // A more specific range wins outright, even when its quality is lower:
    // `application/json;q=0, */*` must exclude JSON, not fall back to `*` `/` `*`.
    if (
      !best ||
      specificity > best.specificity ||
      (specificity === best.specificity && range.quality > best.quality)
    ) {
      best = {
        mediaType,
        quality: range.quality,
        specificity,
        order: range.order,
      };
    }
  }

  if (!best || best.quality <= 0) return null;
  return best;
}

/**
 * Select the best acceptable offer.
 *
 * Ranking is deterministic: quality, then media-range specificity, then the
 * client's ordering of the matching range, then the server's offer order
 * (callers put the route default first).
 */
export function selectMediaType(
  ranges: MediaRange[],
  offers: readonly string[],
): MediaTypeMatch | null {
  let best: MediaTypeMatch | null = null;
  let bestOfferIndex = -1;

  for (let index = 0; index < offers.length; index++) {
    const match = matchOffer(ranges, offers[index]);
    if (!match) continue;

    if (
      !best ||
      match.quality > best.quality ||
      (match.quality === best.quality &&
        match.specificity > best.specificity) ||
      (match.quality === best.quality &&
        match.specificity === best.specificity &&
        match.order < best.order) ||
      (match.quality === best.quality &&
        match.specificity === best.specificity &&
        match.order === best.order &&
        index < bestOfferIndex)
    ) {
      best = match;
      bestOfferIndex = index;
    }
  }

  return best;
}
