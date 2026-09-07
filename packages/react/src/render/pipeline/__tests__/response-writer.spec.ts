import { describe, it, expect, vi } from 'vitest';
import {
  appendVary,
  areHeadersCommitted,
  getResponseHeader,
  setContentType,
  setResponseHeader,
  setResponseHeaderIfAbsent,
  type WritableResponse,
} from '../response-writer';

/** Express-shaped response: vary()/set()/type() plus the Node header API. */
function expressResponse(initial: Record<string, string> = {}) {
  const headers = new Map<string, string>(
    Object.entries(initial).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const response = {
    headersSent: false,
    getHeader: (name: string) => headers.get(name.toLowerCase()),
    setHeader: (name: string, value: string) => {
      headers.set(name.toLowerCase(), value);
    },
    set: (name: string, value: string) => {
      headers.set(name.toLowerCase(), value);
    },
    type: vi.fn((value: string) => {
      headers.set('content-type', value);
    }),
    vary: (field: string) => {
      const existing = headers.get('vary');
      headers.set('vary', existing ? `${existing}, ${field}` : field);
    },
  } as unknown as WritableResponse;
  return { response, headers };
}

/**
 * Fastify-shaped response: `header()`/`getHeader()` buffer on the reply, and
 * the raw Node response is a *separate* store that stays empty until the
 * reply is sent. Modelling that split is the point — sharing one map would
 * hide a reader that looks in the wrong place.
 */
function fastifyResponse(initial: Record<string, string> = {}) {
  const headers = new Map<string, string>(
    Object.entries(initial).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const rawHeaders = new Map<string, string>();
  const response = {
    sent: false,
    getHeader: (name: string) => headers.get(name.toLowerCase()),
    header: (name: string, value: string) => {
      headers.set(name.toLowerCase(), value);
    },
    raw: {
      headersSent: false,
      getHeader: (name: string) => rawHeaders.get(name.toLowerCase()),
      setHeader: (name: string, value: string) => {
        rawHeaders.set(name.toLowerCase(), value);
      },
    },
  } as unknown as WritableResponse;
  return { response, headers };
}

describe('response writer', () => {
  it('reads and writes headers on Express', () => {
    const { response, headers } = expressResponse();
    setResponseHeader(response, 'Cache-Control', 'private, no-store');
    expect(headers.get('cache-control')).toBe('private, no-store');
    expect(getResponseHeader(response, 'Cache-Control')).toBe(
      'private, no-store',
    );
  });

  it('reads and writes headers on Fastify', () => {
    const { response, headers } = fastifyResponse();
    setResponseHeader(response, 'Cache-Control', 'private, no-store');
    expect(headers.get('cache-control')).toBe('private, no-store');
    expect(getResponseHeader(response, 'Cache-Control')).toBe(
      'private, no-store',
    );
  });

  it('does not overwrite a header the application already set', () => {
    for (const make of [expressResponse, fastifyResponse]) {
      const { response, headers } = make({
        'Referrer-Policy': 'no-referrer',
      });
      const wrote = setResponseHeaderIfAbsent(
        response,
        'Referrer-Policy',
        'strict-origin-when-cross-origin',
      );
      expect(wrote).toBe(false);
      expect(headers.get('referrer-policy')).toBe('no-referrer');
    }
  });

  it('appends to Vary without clobbering existing values', () => {
    const { response, headers } = fastifyResponse({ Vary: 'Cookie' });
    appendVary(response, 'Accept');
    appendVary(response, 'X-Current-Layouts');
    expect(headers.get('vary')).toBe('Cookie, Accept, X-Current-Layouts');
  });

  it('accumulates Vary fields it wrote itself on Fastify', () => {
    // Fastify does not surface a buffered header on `raw`; each append must
    // still see the previous one.
    const { response, headers } = fastifyResponse();
    appendVary(response, 'Accept');
    appendVary(response, 'X-Current-Layouts');
    expect(headers.get('vary')).toBe('Accept, X-Current-Layouts');
  });

  it('does not duplicate a Vary field that is already present', () => {
    const { response, headers } = fastifyResponse({ Vary: 'accept' });
    appendVary(response, 'Accept');
    expect(headers.get('vary')).toBe('accept');
  });

  it('leaves a wildcard Vary alone', () => {
    const { response, headers } = fastifyResponse({ Vary: '*' });
    appendVary(response, 'Accept');
    expect(headers.get('vary')).toBe('*');
  });

  it('delegates Vary to Express when it exposes vary()', () => {
    const { response, headers } = expressResponse({ Vary: 'Cookie' });
    appendVary(response, 'Accept');
    expect(headers.get('vary')).toBe('Cookie, Accept');
  });

  it('sets the content type through either adapter', () => {
    const express = expressResponse();
    setContentType(express.response, 'text/html');
    expect(express.headers.get('content-type')).toBe('text/html');

    const fastify = fastifyResponse();
    setContentType(fastify.response, 'application/json');
    expect(fastify.headers.get('content-type')).toBe('application/json');
  });

  it('detects commitment through both adapters', () => {
    expect(areHeadersCommitted({ headersSent: true } as WritableResponse)).toBe(
      true,
    );
    expect(
      areHeadersCommitted({ sent: true } as unknown as WritableResponse),
    ).toBe(true);
    expect(
      areHeadersCommitted({
        raw: { headersSent: true },
      } as unknown as WritableResponse),
    ).toBe(true);
    expect(areHeadersCommitted({} as WritableResponse)).toBe(false);
  });
});
