import { describe, it, expect } from 'vitest';
import { parseJsonc } from '../jsonc';

describe('parseJsonc', () => {
  it('parses plain JSON unchanged', () => {
    expect(parseJsonc('{"a": [1, 2], "b": {"c": null}}')).toEqual({
      a: [1, 2],
      b: { c: null },
    });
  });

  it('drops line and block comments', () => {
    expect(
      parseJsonc('// head\n{ /* a */ "a": 1 // tail\n, "b": /* x */ 2 }'),
    ).toEqual({ a: 1, b: 2 });
  });

  it('drops trailing commas in objects and arrays, across comments', () => {
    expect(parseJsonc('{ "a": [1, 2, ], "b": 3, /* c */ }')).toEqual({
      a: [1, 2],
      b: 3,
    });
  });

  it('leaves comment markers, commas and escaped quotes inside strings', () => {
    expect(
      parseJsonc('{ "a": "x // y /* z */", "b": ",}", "c": "q\\"//" }'),
    ).toEqual({ a: 'x // y /* z */', b: ',}', c: 'q"//' });
  });

  it('still rejects malformed JSON', () => {
    expect(() => parseJsonc('{ "a": }')).toThrow(SyntaxError);
    expect(() => parseJsonc('{ "a": 1,, }')).toThrow(SyntaxError);
  });
});
