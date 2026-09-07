/**
 * The only stage allowed to touch the HTTP response.
 *
 * Nest supports several adapters with different header APIs — Express exposes
 * `vary()`/`set()`/`type()`, Fastify exposes `header()` and a `raw` Node
 * response. Everything here is duck-typed against those surfaces so status,
 * content type, and headers behave identically on both.
 */

interface RawHeaderCapable {
  getHeader?: (name: string) => number | string | string[] | undefined;
  setHeader?: (name: string, value: string) => unknown;
  headersSent?: boolean;
}

/** The response surface this writer probes. */
export interface WritableResponse extends RawHeaderCapable {
  vary?: (field: string) => unknown;
  header?: (name: string, value: string) => unknown;
  set?: (name: string, value: string) => unknown;
  type?: (value: string) => unknown;
  status?: (code: number) => unknown;
  statusCode?: number;
  raw?: RawHeaderCapable;
}

/**
 * Read a header value already set on the response.
 *
 * The framework object is asked first and the raw Node response only as a
 * fallback. Fastify buffers headers on the reply until it is sent, so reading
 * `raw` there returns nothing for a header this pipeline just wrote — and the
 * next append would silently drop the earlier value.
 */
export function getResponseHeader(
  response: WritableResponse,
  name: string,
): string | undefined {
  const own =
    typeof response?.getHeader === 'function'
      ? response.getHeader(name)
      : undefined;
  const value =
    own ??
    (typeof response?.raw?.getHeader === 'function'
      ? response.raw.getHeader(name)
      : undefined);

  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value.join(', ') : String(value);
}

/** Set a header, overwriting any existing value. */
export function setResponseHeader(
  response: WritableResponse,
  name: string,
  value: string,
): void {
  if (typeof response?.header === 'function') {
    response.header(name, value);
    return;
  }
  if (typeof response?.set === 'function') {
    response.set(name, value);
    return;
  }
  const target: RawHeaderCapable = response?.raw ?? response;
  target?.setHeader?.(name, value);
}

/**
 * Set a header only when the application has not already set one.
 *
 * Host middleware (helmet, a reverse proxy shim, an app-specific policy) runs
 * before rendering and is assumed to know better than a library default, so
 * its header is preserved rather than overwritten.
 */
export function setResponseHeaderIfAbsent(
  response: WritableResponse,
  name: string,
  value: string,
): boolean {
  if (getResponseHeader(response, name) !== undefined) return false;
  setResponseHeader(response, name, value);
  return true;
}

/**
 * Append a field to `Vary` without clobbering an existing value, and without
 * duplicating a field another layer already added.
 */
export function appendVary(response: WritableResponse, field: string): void {
  if (typeof response?.vary === 'function') {
    response.vary(field);
    return;
  }

  const existing = getResponseHeader(response, 'Vary');
  const values = existing ? existing.split(',') : [];

  if (values.some((value) => value.trim() === '*')) return;
  if (
    !values.some((value) => value.trim().toLowerCase() === field.toLowerCase())
  ) {
    values.push(field);
  }

  const next = values
    .map((value) => value.trim())
    .filter(Boolean)
    .join(', ');

  setResponseHeader(response, 'Vary', next);
}

/** Set the response content type on either adapter. */
export function setContentType(
  response: WritableResponse,
  mediaType: string,
): void {
  if (typeof response?.type === 'function') {
    response.type(mediaType);
    return;
  }
  setResponseHeader(response, 'Content-Type', mediaType);
}

/** Whether response headers have already gone out. */
export function areHeadersCommitted(response: WritableResponse): boolean {
  if (typeof (response as { sent?: unknown }).sent === 'boolean') {
    return (response as { sent: boolean }).sent;
  }
  if (typeof response?.headersSent === 'boolean') return response.headersSent;
  return response?.raw?.headersSent === true;
}
