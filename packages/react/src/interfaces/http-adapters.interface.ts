import type { ServerResponse } from 'http';

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
 * Fastify-specific response type.
 */
export interface FastifyLikeResponse extends SSRResponse {
  /** Fastify uses 'sent' to indicate headers have been sent */
  sent: boolean;
  /** Raw Node.js ServerResponse */
  raw: RawServerResponse | ServerResponse;
}
