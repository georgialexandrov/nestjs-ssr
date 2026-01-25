import type { ServerResponse, IncomingMessage } from 'http';

/**
 * Common HTTP request interface that works with both Express and Fastify.
 * This represents the minimal interface needed for SSR context building.
 */
export interface SSRRequest {
  /** Full request URL including query string */
  url: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Request headers */
  headers: Record<string, string | string[] | undefined>;
  /** URL path (Express: path, Fastify: routeOptions.url or url without query) */
  path?: string;
  /** Parsed query parameters */
  query?: Record<string, string | string[] | undefined>;
  /** Route parameters */
  params?: Record<string, string>;
  /** Parsed cookies (requires cookie-parser middleware) */
  cookies?: Record<string, string>;
  /**
   * User object populated by authentication middleware (e.g., Passport).
   * Type is `unknown` since the shape depends on your auth strategy.
   */
  user?: unknown;
  /** Allow any additional properties for framework-specific extensions */
  [key: string]: unknown;
}

/**
 * Express-specific request type.
 * Use this when you know you're working with Express.
 */
export interface ExpressLikeRequest extends SSRRequest {
  /** Express path property */
  path: string;
  /** Express query object */
  query: Record<string, string | string[] | undefined>;
  /** Express params object */
  params: Record<string, string>;
}

/**
 * Fastify-specific request type.
 * Use this when you know you're working with Fastify.
 */
export interface FastifyLikeRequest extends SSRRequest {
  /** Fastify raw request (Node.js IncomingMessage) */
  raw: IncomingMessage;
  /** Fastify route parameters */
  params: Record<string, string>;
  /** Fastify query parameters */
  query: Record<string, string | string[] | undefined>;
}

/**
 * Minimal interface for the raw Node.js response.
 * This is a subset of ServerResponse that we actually use for streaming SSR.
 */
export interface RawServerResponse {
  statusCode: number;
  headersSent: boolean;
  writableEnded: boolean;
  setHeader(name: string, value: string | number | readonly string[]): void;
  write(chunk: string | Buffer): boolean;
  end(data?: string | Buffer): void;
  on?(event: string, listener: (...args: any[]) => void): this;
}

/**
 * Common HTTP response interface that works with both Express and Fastify.
 * For streaming SSR, we access the raw Node.js ServerResponse.
 */
export interface SSRResponse {
  /** HTTP status code (optional - Fastify has it on raw) */
  statusCode?: number;
  /** Whether headers have been sent (Express) */
  headersSent?: boolean;
  /** Whether headers have been sent (Fastify uses 'sent') */
  sent?: boolean;
  /** Whether the response stream has ended */
  writableEnded?: boolean;
  /** Set a response header */
  setHeader?(name: string, value: string | number | readonly string[]): void;
  /** Write data to the response */
  write?(chunk: string | Buffer): boolean;
  /** End the response */
  end?(data?: string | Buffer): void;
  /** Event listener for 'close' event */
  on?(event: string, listener: (...args: any[]) => void): this;
  /** Raw Node.js response (Fastify) - uses minimal interface for easier testing */
  raw?: RawServerResponse | ServerResponse;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * Express-specific response type.
 */
export interface ExpressLikeResponse extends SSRResponse {
  headersSent: boolean;
  setHeader(name: string, value: string | number | readonly string[]): void;
  write(chunk: string | Buffer): boolean;
  end(data?: string | Buffer): void;
}

/**
 * Fastify-specific response type.
 */
export interface FastifyLikeResponse extends SSRResponse {
  /** Fastify uses 'sent' to indicate headers have been sent */
  sent: boolean;
  /** Raw Node.js ServerResponse */
  raw: RawServerResponse | ServerResponse;
}

/**
 * Type guard to check if response is Fastify-like (has .raw property)
 */
export function isFastifyResponse(
  res: SSRResponse,
): res is FastifyLikeResponse {
  return (
    res != null &&
    typeof res === 'object' &&
    'raw' in res &&
    res.raw != null &&
    typeof (res.raw as ServerResponse).write === 'function'
  );
}

/**
 * Type guard to check if response is Express-like (direct ServerResponse methods)
 */
export function isExpressResponse(
  res: SSRResponse,
): res is ExpressLikeResponse {
  return (
    res != null &&
    typeof res === 'object' &&
    typeof res.write === 'function' &&
    typeof res.setHeader === 'function' &&
    !('raw' in res && res.raw != null)
  );
}

/**
 * Type guard to check if request is Fastify-like (has .raw property)
 */
export function isFastifyRequest(req: SSRRequest): req is FastifyLikeRequest {
  return (
    req != null && typeof req === 'object' && 'raw' in req && req.raw != null
  );
}
