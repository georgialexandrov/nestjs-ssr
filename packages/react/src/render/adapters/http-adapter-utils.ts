import type { ServerResponse } from 'http';
import type {
  SSRResponse,
  FastifyLikeResponse,
} from '../../interfaces/http-adapters.interface';

/**
 * HTTP adapter type detection and response normalization utilities.
 *
 * Both Express and Fastify expose the underlying Node.js ServerResponse,
 * but through different interfaces:
 * - Express: `res` IS the ServerResponse (or extends it)
 * - Fastify: `res.raw` gives access to ServerResponse
 *
 * These utilities normalize the differences for streaming SSR.
 */

export type AdapterType = 'express' | 'fastify' | 'unknown';

/**
 * Detect the HTTP adapter type from NestJS HttpAdapterHost
 */
export function detectAdapterType(httpAdapterHost: any): AdapterType {
  const adapter = httpAdapterHost?.httpAdapter;
  if (!adapter) return 'unknown';

  const instance = adapter.getInstance();

  // Fastify has a 'register' method for plugins
  if (instance && typeof instance.register === 'function') {
    return 'fastify';
  }

  // Express has a router and use() method
  if (
    instance &&
    typeof instance.use === 'function' &&
    typeof instance.get === 'function'
  ) {
    return 'express';
  }

  return 'unknown';
}

/**
 * Type guard to check if response is Fastify-like (has .raw property)
 */
function isFastifyLikeResponse(res: SSRResponse): res is FastifyLikeResponse {
  return (
    res != null &&
    typeof res === 'object' &&
    'raw' in res &&
    res.raw != null &&
    typeof res.raw.write === 'function'
  );
}

/**
 * Get the raw Node.js ServerResponse from a framework response object.
 *
 * This allows us to use the same streaming code for both Express and Fastify
 * by accessing the underlying Node.js response object.
 *
 * @param res - Express Response or Fastify FastifyReply
 * @returns The raw Node.js ServerResponse
 */
export function getRawResponse(res: SSRResponse): ServerResponse {
  // Fastify wraps the response - access via .raw
  if (isFastifyLikeResponse(res)) {
    // Cast to ServerResponse since RawServerResponse is a subset
    return res.raw as ServerResponse;
  }
  // Express response IS the Node response (or extends it)
  return res as unknown as ServerResponse;
}

/**
 * Check if headers have been sent on the response.
 *
 * Different frameworks use different properties:
 * - Fastify: `res.sent`
 * - Express/Node: `res.headersSent`
 *
 * @param res - Express Response or Fastify FastifyReply
 * @returns true if headers have been sent
 */
export function isHeadersSent(res: SSRResponse): boolean {
  // Fastify uses res.sent
  if (typeof res.sent === 'boolean') {
    return res.sent;
  }
  // Express uses res.headersSent (from Node.js)
  return res.headersSent === true;
}
