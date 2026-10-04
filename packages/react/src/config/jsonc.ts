/**
 * Parse JSON with comments and trailing commas (JSONC), the format tsc and
 * the Nest CLI accept for `tsconfig*.json` and `nest-cli.json`.
 *
 * One pass drops comments and any comma whose next significant character
 * closes an object or array. String literals are copied whole, so `//` or
 * `/*` inside a value is kept. `JSON.parse` still rejects anything else.
 */
export function parseJsonc(text: string): unknown {
  let out = '';
  let comma = -1; // index in `out` of a comma that may turn out to trail
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '/' && text[i + 1] === '/') {
      while (i + 1 < text.length && text[i + 1] !== '\n') i++;
    } else if (char === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 1;
    } else if (/\s/.test(char)) {
      out += char;
    } else {
      if (comma !== -1 && (char === '}' || char === ']')) {
        out = out.slice(0, comma) + out.slice(comma + 1);
      }
      comma = char === ',' ? out.length : -1;
      if (char === '"') {
        const start = i;
        for (i++; i < text.length && text[i] !== '"'; i++) {
          if (text[i] === '\\') i++;
        }
        out += text.slice(start, i + 1);
      } else {
        out += char;
      }
    }
  }
  return JSON.parse(out);
}
