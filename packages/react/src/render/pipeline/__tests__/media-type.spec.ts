import { describe, it, expect } from 'vitest';
import {
  MAX_MEDIA_RANGES,
  matchOffer,
  parseAcceptHeader,
  parseMediaType,
  selectMediaType,
} from '../media-type';

const HTML = 'text/html';
const JSON_TYPE = 'application/json';

function select(accept: string | undefined, offers: string[]) {
  return selectMediaType(parseAcceptHeader(accept), offers)?.mediaType ?? null;
}

describe('parseAcceptHeader', () => {
  it('treats an absent header as a wildcard', () => {
    expect(parseAcceptHeader(undefined)).toEqual([
      {
        type: '*',
        subtype: '*',
        suffix: null,
        quality: 1,
        parameters: {},
        order: 0,
      },
    ]);
  });

  it('treats an empty header as a wildcard', () => {
    expect(parseAcceptHeader('   ')[0].type).toBe('*');
  });

  it('parses qualities', () => {
    const ranges = parseAcceptHeader('text/html;q=0.8, application/json;q=1');
    expect(ranges.map((r) => r.quality)).toEqual([0.8, 1]);
  });

  it('parses media parameters before q, and ignores extensions after it', () => {
    const [range] = parseAcceptHeader(
      'application/json;version=2;q=0.5;charset=utf-8',
    );
    expect(range.parameters).toEqual({ version: '2' });
    expect(range.quality).toBe(0.5);
  });

  it('keeps quoted parameter values intact, commas included', () => {
    const ranges = parseAcceptHeader('application/json;profile="a,b"');
    expect(ranges).toHaveLength(1);
    expect(ranges[0].parameters.profile).toBe('a,b');
  });

  it('drops a range with a malformed q rather than assuming q=1', () => {
    const ranges = parseAcceptHeader('text/html;q=banana, application/json');
    expect(ranges.map((r) => `${r.type}/${r.subtype}`)).toEqual([
      'application/json',
    ]);
  });

  it('drops syntactically invalid ranges but keeps the rest', () => {
    const ranges = parseAcceptHeader('texthtml, */json, text/, /html, text/*');
    expect(ranges.map((r) => `${r.type}/${r.subtype}`)).toEqual(['text/*']);
  });

  it('records structured suffixes', () => {
    const [range] = parseAcceptHeader('application/ld+json');
    expect(range.suffix).toBe('json');
  });

  it('bounds how many ranges it will parse', () => {
    const header = Array.from({ length: 500 }, (_, i) => `x/y${i}`).join(',');
    expect(parseAcceptHeader(header).length).toBe(MAX_MEDIA_RANGES);
  });

  it('joins a repeated header sent as an array', () => {
    const ranges = parseAcceptHeader(['text/html', 'application/json']);
    expect(ranges).toHaveLength(2);
  });
});

describe('parseMediaType', () => {
  it('parses a concrete type and its suffix', () => {
    expect(parseMediaType('application/vnd.acme+json')).toEqual({
      type: 'application',
      subtype: 'vnd.acme+json',
      suffix: 'json',
    });
  });

  it('rejects a malformed type', () => {
    expect(parseMediaType('nope')).toBeNull();
  });
});

describe('selectMediaType', () => {
  it('selects the route default when the header is absent', () => {
    expect(select(undefined, [HTML, JSON_TYPE])).toBe(HTML);
  });

  it('selects the route default for an equally ranked wildcard', () => {
    expect(select('*/*', [HTML, JSON_TYPE])).toBe(HTML);
    expect(select('*/*', [JSON_TYPE, HTML])).toBe(JSON_TYPE);
  });

  it('honours quality weights', () => {
    expect(select('text/html, application/json;q=0.5', [HTML, JSON_TYPE])).toBe(
      HTML,
    );
    expect(select('text/html;q=0.5, application/json', [HTML, JSON_TYPE])).toBe(
      JSON_TYPE,
    );
  });

  it('excludes a representation weighted q=0', () => {
    expect(
      select('application/json;q=0, text/html;q=0.8', [HTML, JSON_TYPE]),
    ).toBe(HTML);
  });

  it('lets a specific q=0 override a permissive wildcard', () => {
    expect(select('*/*, application/json;q=0', [JSON_TYPE])).toBeNull();
  });

  it('prefers the more specific range at equal quality', () => {
    expect(select('text/*;q=0.9, text/html;q=0.9', [HTML])).toBe(HTML);
    // HTML is the first offer, but the client named JSON exactly and HTML
    // only through a wildcard, so the more specific range decides.
    expect(select('text/*;q=1, application/json;q=1', [HTML, JSON_TYPE])).toBe(
      JSON_TYPE,
    );
  });

  it('breaks a full tie with the client ordering', () => {
    expect(select('text/html, application/json', [JSON_TYPE, HTML])).toBe(HTML);
    expect(select('application/json, text/html', [JSON_TYPE, HTML])).toBe(
      JSON_TYPE,
    );
  });

  it('matches a structured JSON suffix range against a JSON offer', () => {
    expect(select('application/*+json', [JSON_TYPE])).toBe(JSON_TYPE);
    expect(select('application/*+json', ['application/vnd.acme+json'])).toBe(
      'application/vnd.acme+json',
    );
  });

  it('does not match an unrelated suffix', () => {
    expect(select('application/*+xml', [JSON_TYPE])).toBeNull();
  });

  it('returns null when nothing is acceptable', () => {
    expect(select('image/png', [HTML, JSON_TYPE])).toBeNull();
  });

  it('ignores parameters when matching the media range', () => {
    expect(select('text/html;level=1', [HTML])).toBe(HTML);
  });
});

describe('matchOffer', () => {
  it('reports the specificity of the winning range', () => {
    const ranges = parseAcceptHeader('*/*, text/html');
    expect(matchOffer(ranges, HTML)?.specificity).toBe(3);
  });

  it('returns null for an unmatched offer', () => {
    expect(matchOffer(parseAcceptHeader('text/html'), JSON_TYPE)).toBeNull();
  });
});

describe('hostile Accept headers', () => {
  const hostile = [
    '',
    ',',
    ';;;',
    'q=1',
    '/',
    '*/*;q=',
    '*/*;q=1.5',
    'text/html;q=-1',
    'text/html;;;q=0.5',
    'text/html;q=0.5;q=1',
    '"',
    'text/html;profile="unterminated',
    ' / ',
    'a'.repeat(50_000),
    Array.from({ length: 2000 }, () => 'text/html;q=0.1').join(','),
    '*/*;q=0',
  ];

  it.each(hostile)('parses without throwing: %s', (header) => {
    expect(() => {
      const ranges = parseAcceptHeader(header);
      expect(ranges.length).toBeLessThanOrEqual(MAX_MEDIA_RANGES);
      selectMediaType(ranges, [HTML, JSON_TYPE]);
    }).not.toThrow();
  });

  it('never selects a representation the client excluded outright', () => {
    expect(select('*/*;q=0', [HTML, JSON_TYPE])).toBeNull();
  });

  it('fuzzes bounded parser input without crashes or unbounded output', () => {
    let state = 0x5eed1234;
    const next = () => (state = (state * 1664525 + 1013904223) >>> 0);
    const alphabet = 'abcABC012*/+;=,.-_" \\';

    for (let sample = 0; sample < 500; sample++) {
      const length = next() % 2048;
      let header = '';
      for (let index = 0; index < length; index++) {
        header += alphabet[next() % alphabet.length];
      }

      const ranges = parseAcceptHeader(header);
      expect(ranges.length).toBeLessThanOrEqual(MAX_MEDIA_RANGES);
      expect(() => selectMediaType(ranges, [HTML, JSON_TYPE])).not.toThrow();
    }
  });
});
