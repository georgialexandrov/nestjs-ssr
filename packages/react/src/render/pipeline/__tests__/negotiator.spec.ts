import { describe, it, expect } from 'vitest';
import {
  HTML_MEDIA_TYPE,
  JSON_MEDIA_TYPE,
  MAX_SEGMENT_LAYOUTS,
  SEGMENT_MEDIA_TYPE,
  buildNotAcceptableBody,
  isNotAcceptable,
  negotiate,
  parseSegmentHeader,
  type NegotiableRequest,
} from '../negotiator';
import { defaultResolvedPolicy } from '../representation-policy';

function request(
  headers: Record<string, string | string[] | undefined> = {},
  method = 'GET',
): NegotiableRequest {
  return { method, headers };
}

const htmlOnly = defaultResolvedPolicy();
const both = { ...defaultResolvedPolicy(), json: true };
const jsonOnly = {
  ...defaultResolvedPolicy(),
  html: false,
  json: true,
  default: 'json' as const,
};

describe('parseSegmentHeader', () => {
  it('parses a valid layout chain', () => {
    expect(
      parseSegmentHeader(request({ 'x-current-layouts': 'Root, Admin' })),
    ).toEqual(['Root', 'Admin']);
  });

  it('ignores the header on a non-GET request', () => {
    expect(
      parseSegmentHeader(request({ 'x-current-layouts': 'Root' }, 'POST')),
    ).toBeNull();
  });

  it('rejects a chain longer than the limit', () => {
    const names = Array.from(
      { length: MAX_SEGMENT_LAYOUTS + 1 },
      (_, i) => `L${i}`,
    ).join(',');
    expect(
      parseSegmentHeader(request({ 'x-current-layouts': names })),
    ).toBeNull();
  });

  it('rejects names that are not component names', () => {
    expect(
      parseSegmentHeader(request({ 'x-current-layouts': 'Root,<script>' })),
    ).toBeNull();
  });
});

describe('negotiate', () => {
  it('serves HTML when the Accept header is absent', () => {
    const result = negotiate(request(), {
      policy: both,
      clientNavigation: true,
    });
    expect(isNotAcceptable(result)).toBe(false);
    expect(result).toMatchObject({ kind: 'html', mediaType: HTML_MEDIA_TYPE });
  });

  it('serves JSON when the client asks for it', () => {
    const result = negotiate(request({ accept: 'application/json' }), {
      policy: both,
      clientNavigation: true,
    });
    expect(result).toMatchObject({ kind: 'json', mediaType: JSON_MEDIA_TYPE });
  });

  it('offers a declared vendor media type alongside application/json', () => {
    const result = negotiate(request({ accept: 'application/*+json' }), {
      policy: both,
      clientNavigation: true,
      jsonMediaType: 'application/vnd.acme+json',
    });
    expect(result).toMatchObject({
      kind: 'json',
      mediaType: 'application/vnd.acme+json',
    });
  });

  it('returns 406 metadata when JSON is not enabled', () => {
    const result = negotiate(request({ accept: 'application/json' }), {
      policy: htmlOnly,
      clientNavigation: true,
    });
    expect(isNotAcceptable(result)).toBe(true);
    if (isNotAcceptable(result)) {
      expect(result.offered).toEqual([HTML_MEDIA_TYPE]);
      // The body keeps the shape previous releases documented.
      expect(buildNotAcceptableBody(result.offered, { legacy: true })).toEqual({
        error: 'Not Acceptable',
        message: 'JSON response not available for this route',
      });
    }
  });

  it('returns 406 when HTML is not enabled and HTML is requested', () => {
    const result = negotiate(request({ accept: 'text/html' }), {
      policy: jsonOnly,
      clientNavigation: true,
    });
    expect(isNotAcceptable(result)).toBe(true);
  });

  it('serves JSON on an html-less route when the client states no preference', () => {
    const result = negotiate(request({ accept: '*/*' }), {
      policy: jsonOnly,
      clientNavigation: true,
    });
    expect(result).toMatchObject({ kind: 'json' });
  });

  describe('standards negotiation for explicit representations', () => {
    it('ranks quality before route order', () => {
      const result = negotiate(
        request({ accept: 'text/html, application/json;q=0.5' }),
        { policy: both, clientNavigation: true },
      );
      expect(result).toMatchObject({ kind: 'html' });
    });

    it('excludes media ranges with q=0', () => {
      const result = negotiate(
        request({ accept: 'application/json;q=0, text/html;q=0.5' }),
        { policy: both, clientNavigation: true },
      );
      expect(result).toMatchObject({ kind: 'html' });
    });

    it('refuses a request that excludes every offered representation', () => {
      const result = negotiate(request({ accept: 'image/png' }), {
        policy: both,
        clientNavigation: true,
      });
      expect(isNotAcceptable(result)).toBe(true);
      if (isNotAcceptable(result)) {
        expect(buildNotAcceptableBody(result.offered)).toEqual({
          error: 'Not Acceptable',
          message: 'No acceptable representation is available for this route',
          acceptable: ['text/html', 'application/json'],
        });
      }
    });

    it('serves segments as application/json', () => {
      const result = negotiate(request({ 'x-current-layouts': 'RootLayout' }), {
        policy: both,
        clientNavigation: true,
      });
      expect(result).toMatchObject({
        kind: 'segment',
        mediaType: 'application/json',
      });
    });
  });

  describe('legacy negotiation compatibility', () => {
    const options = {
      policy: both,
      clientNavigation: true,
      mode: 'legacy' as const,
    };

    it('retains the historical substring behavior, including q=0', () => {
      for (const accept of [
        'text/html, application/json;q=0.5',
        'application/json;q=0',
      ]) {
        expect(negotiate(request({ accept }), options)).toMatchObject({
          kind: 'json',
        });
      }
    });

    it('falls back to HTML for wildcard, suffix, and unrelated types', () => {
      for (const accept of [
        undefined,
        '*/*',
        'application/*',
        'application/problem+json',
        'image/png',
      ]) {
        expect(
          negotiate(request(accept ? { accept } : {}), options),
        ).toMatchObject({ kind: 'html' });
      }
    });
  });

  it('prefers a segment over JSON negotiation', () => {
    const result = negotiate(
      request({
        accept: 'application/json',
        'x-current-layouts': 'RootLayout',
      }),
      { policy: both, clientNavigation: true },
    );
    expect(result).toMatchObject({
      kind: 'segment',
      mediaType: SEGMENT_MEDIA_TYPE,
      currentLayouts: ['RootLayout'],
    });
  });

  it('falls back to Accept negotiation for an invalid segment header', () => {
    const result = negotiate(
      request({
        accept: 'application/json',
        'x-current-layouts': 'Root,<bad>',
      }),
      { policy: both, clientNavigation: true },
    );
    expect(result).toMatchObject({ kind: 'json' });
  });

  it('ignores the segment header when client navigation is disabled', () => {
    const result = negotiate(request({ 'x-current-layouts': 'RootLayout' }), {
      policy: both,
      clientNavigation: false,
    });
    expect(result).toMatchObject({ kind: 'html' });
  });

  it('varies on Accept, and on the segment header when navigation is on', () => {
    const withNav = negotiate(request(), {
      policy: both,
      clientNavigation: true,
    });
    expect(withNav.vary).toEqual(['Accept', 'X-Current-Layouts']);

    const withoutNav = negotiate(request(), {
      policy: both,
      clientNavigation: false,
    });
    expect(withoutNav.vary).toEqual(['Accept']);
  });

  it('honours a json route default for an unspecific client', () => {
    const result = negotiate(request({ accept: '*/*' }), {
      policy: { ...both, default: 'json' },
      clientNavigation: true,
    });
    expect(result).toMatchObject({ kind: 'json' });
  });
});
