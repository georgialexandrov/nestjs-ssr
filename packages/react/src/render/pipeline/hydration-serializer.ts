import { uneval } from 'devalue';
import { isFrozenPublicSnapshot, isJsonExactSnapshot } from './public-snapshot';

/**
 * Serialize a value into the JavaScript expression that recreates it, for the
 * hydration script. For most payloads the output is exactly
 * `devalue.uneval(value)`; see the JSON-exact fast path below for the one
 * case where it deliberately is not.
 *
 * devalue walks a value twice (once to count repeated references, once to
 * emit) and is general enough for Maps, typed arrays and cycles. Page props
 * and context are almost always a plain tree of objects, arrays, strings and
 * numbers, which can be emitted in a single pass. Two fast paths exist, tried
 * in order, both gated on the value being a frozen public snapshot (its
 * objects are data properties the snapshot itself created, so reading each
 * property once instead of twice cannot differ):
 *
 * 1. **JSON-exact.** `isJsonExactSnapshot` is a tag the snapshot walk already
 *    computed for free (see `public-snapshot.ts`): the tree has none of the
 *    constructs where a JSON expression and a devalue expression evaluate
 *    differently (NaN/Infinity/-0, `undefined`, holes, Date, non-plain or
 *    null-prototype objects, shared references, bigint). For those trees
 *    `JSON.stringify` is a valid single-pass emitter and needs no walk of its
 *    own on this side — V8's native stringifier does it — so this is faster
 *    than `emitPlainTree` below, at the cost of quoted keys (devalue also
 *    quotes any key that is not a valid identifier, so this differs only on
 *    identifier-shaped keys). A JSON object/array literal is valid JS syntax
 *    and evaluates to the same value `JSON.parse` would produce, so the text
 *    is embedded as-is (no `JSON.parse` call) once the characters that would
 *    let it escape the `<script>` tag are escaped.
 * 2. **`emitPlainTree`.** Reproduces devalue's output byte for byte for the
 *    plain-tree subset; used whenever the tree is not JSON-exact but is still
 *    plain (repeated long strings are the common reason: harmless for JSON,
 *    which has no notion of identity, but devalue hoists them, so
 *    `emitPlainTree` bails on them — see its own doc comment).
 *
 * Anything outside both subsets, and every value that is not such a
 * snapshot, goes to devalue unchanged.
 */
export function serializeForHydration(value: unknown): string {
  if (isJsonExactSnapshot(value)) {
    return escapeForScript(JSON.stringify(value));
  }
  if (isFrozenPublicSnapshot(value)) {
    const fast = emitPlainTree(value);
    if (fast !== undefined) return fast;
  }
  return uneval(value);
}

/**
 * Characters `JSON.stringify` leaves raw that are unsafe inside an inline
 * `<script>`: `<` (so neither `</script>` nor an HTML comment opener `<!--`
 * can appear) and the two line terminators JSON permits in strings but a
 * `<script>` body historically could not (kept escaped for parity with
 * devalue's own output, and for any non-JS consumer of the same HTML).
 */
// eslint-disable-next-line no-control-regex
const NEEDS_SCRIPT_ESCAPE = /[<\u2028\u2029]/;
const SCRIPT_ESCAPES: Record<string, string> = {
  '<': '\\u003C',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

/** Check first, as `stringLiteral` below does: most payloads need no escaping. */
function escapeForScript(json: string): string {
  if (!NEEDS_SCRIPT_ESCAPE.test(json)) return json;
  return json.replace(
    // eslint-disable-next-line no-control-regex
    /[<\u2028\u2029]/g,
    (char) => SCRIPT_ESCAPES[char] ?? char,
  );
}

/** devalue hoists repeated strings of at least this length into variables. */
const MIN_HOISTED_STRING_LENGTH = 128;

const IDENTIFIER = /^[_$a-zA-Z][_$a-zA-Z0-9]*$/;
/** Characters devalue escapes inside a string literal. */
// eslint-disable-next-line no-control-regex
const NEEDS_ESCAPE = /["<\\\u0000-\u001f\u2028\u2029]/;
// eslint-disable-next-line no-control-regex
const UNSAFE_IN_KEY = /[<\b\f\n\r\t\0\u2028\u2029]/g;

const KEY_ESCAPES: Record<string, string> = {
  '<': '\\u003C',
  '\\': '\\\\',
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

/** devalue's `get_escaped_char`, character for character. */
function escapeChar(char: string): string {
  switch (char) {
    case '"':
      return '\\"';
    case '<':
      return '\\u003C';
    case '\\':
      return '\\\\';
    case '\n':
      return '\\n';
    case '\r':
      return '\\r';
    case '\t':
      return '\\t';
    case '\b':
      return '\\b';
    case '\f':
      return '\\f';
    case '\u2028':
      return '\\u2028';
    case '\u2029':
      return '\\u2029';
    default:
      return char < ' '
        ? `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
        : '';
  }
}

/** devalue's `stringify_string`, with a check-first fast path. */
function stringLiteral(value: string): string {
  if (!NEEDS_ESCAPE.test(value)) return `"${value}"`;
  let result = '';
  let last = 0;
  for (let index = 0; index < value.length; index++) {
    const replacement = escapeChar(value[index]);
    if (replacement) {
      result += value.slice(last, index) + replacement;
      last = index + 1;
    }
  }
  return `"${result}${value.slice(last)}"`;
}

/** devalue's `safe_key`. */
function objectKey(key: string): string {
  return IDENTIFIER.test(key)
    ? key
    : JSON.stringify(key).replace(UNSAFE_IN_KEY, (c) => KEY_ESCAPES[c] ?? c);
}

/** devalue's `stringify_primitive` for numbers. */
function numberLiteral(value: number): string {
  if (value === 0 && 1 / value < 0) return '-0';
  const text = String(value);
  return Number.isInteger(value) ? text : text.replace(/^(-)?0\./, '$1.');
}

/**
 * Emit a plain tree the way devalue would, or return undefined as soon as the
 * value leaves the subset whose output is known to be identical: a repeated
 * object or long string (devalue hoists those), a hole in an array, a
 * non-plain object, symbols, bigint, functions, or any other built-in.
 */
export function emitPlainTree(root: unknown): string | undefined {
  const visited = new Set<object>();
  let longStrings: Set<string> | undefined;
  let bail = false;

  const emit = (value: unknown): string => {
    if (bail) return '';
    switch (typeof value) {
      case 'string':
        if (value.length >= MIN_HOISTED_STRING_LENGTH) {
          longStrings ??= new Set();
          if (longStrings.has(value)) {
            bail = true;
            return '';
          }
          longStrings.add(value);
        }
        return stringLiteral(value);
      case 'number':
        return numberLiteral(value);
      case 'boolean':
        return value ? 'true' : 'false';
      case 'undefined':
        return 'void 0';
      case 'object':
        break;
      default:
        // bigint, symbol, function: devalue's own handling differs.
        bail = true;
        return '';
    }
    if (value === null) return 'null';

    const object = value;
    if (visited.has(object)) {
      bail = true;
      return '';
    }
    visited.add(object);

    if (Array.isArray(object)) {
      if (Object.prototype.toString.call(object) !== '[object Array]') {
        bail = true;
        return '';
      }
      let out = '[';
      for (let index = 0; index < object.length; index++) {
        if (!Object.hasOwn(object, index)) {
          bail = true;
          return '';
        }
        if (index > 0) out += ',';
        out += emit(object[index]);
      }
      return `${out}]`;
    }

    if (object instanceof Date) {
      if (
        Object.prototype.toString.call(object) !== '[object Date]' ||
        Object.getPrototypeOf(object) !== Date.prototype
      ) {
        bail = true;
        return '';
      }
      return `new Date(${object.getTime()})`;
    }

    const prototype: unknown = Object.getPrototypeOf(object);
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      Object.getOwnPropertySymbols(object).length > 0
    ) {
      bail = true;
      return '';
    }

    let out = '';
    let first = true;
    for (const key of Object.keys(object)) {
      if (key === '__proto__') {
        bail = true;
        return '';
      }
      out += `${first ? '' : ','}${objectKey(key)}:${emit(
        (object as Record<string, unknown>)[key],
      )}`;
      first = false;
    }
    if (prototype === null) {
      return first ? '{__proto__:null}' : `{${out},__proto__:null}`;
    }
    return `{${out}}`;
  };

  const result = emit(root);
  return bail ? undefined : result;
}

/**
 * Recursion cap for {@link isPlainHydratableValue}. Legitimate head data
 * (title/description/meta/links/htmlAttributes, ...) is shallow by
 * construction; this only exists to bound the cost of adversarial input
 * (e.g. a deeply nested `jsonLd` entry) to a cheap "give up, fall back"
 * check instead of unbounded recursion.
 */
const MAX_PLAIN_VALUE_DEPTH = 32;

/**
 * True when `value` is guaranteed to read the same way every time: a
 * string, finite-or-not number, boolean, undefined, null, or an array/plain
 * object built entirely from such values via ordinary *data* properties (no
 * getters, no symbol keys, no exotic prototype).
 *
 * This is the safety net {@link serializeForHydration}'s own fast paths get
 * for free from `snapshotPublicPayload` (which only tags *frozen* trees it
 * built itself) but a value like `HeadData` never goes through: it is
 * small, application-literal, and passed straight to the serializer without
 * ever being snapshotted. Without this check, calling `emitPlainTree`
 * directly on arbitrary unfrozen input would be unsound — a getter could
 * legitimately return a different value on a second read, and devalue's own
 * two-pass walk (dedupe, then emit) might not agree with a single read
 * either. Requiring plain data properties throughout removes that risk: a
 * data property reads the same value every time, so one read is as good as
 * two.
 *
 * Deliberately stricter than `emitPlainTree`'s own bail conditions (which
 * assume this safety already holds) — this is the gate that makes calling
 * it on raw, unsnapshotted data sound in the first place.
 */
export function isPlainHydratableValue(
  value: unknown,
  depth = 0,
): boolean {
  if (depth > MAX_PLAIN_VALUE_DEPTH) return false;
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'undefined':
      return true;
    case 'object':
      break;
    default:
      // bigint, function, symbol
      return false;
  }
  if (value === null) return true;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index)) return false; // holes
      if (!isPlainHydratableValue(value[index], depth + 1)) return false;
    }
    return true;
  }
  if (value instanceof Date) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  if (Object.getOwnPropertySymbols(value).length > 0) return false;
  for (const key of Object.keys(value)) {
    if (key === '__proto__') return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) return false; // accessor
    if (!isPlainHydratableValue(descriptor.value, depth + 1)) return false;
  }
  return true;
}

/**
 * Fast path for small, application-literal values that are never routed
 * through `snapshotPublicPayload` before hydration (`HeadData` is the only
 * current caller) — `window.__HEAD__`'s payload, in practice a handful of
 * strings, booleans and small nested arrays/objects.
 *
 * Byte-identical to `serializeForHydration(value)` for every input: when
 * {@link isPlainHydratableValue} holds, `emitPlainTree` reproduces devalue's
 * output exactly and safely (see that function's doc comment for why a
 * single read is sound here); anything else — Dates, class instances,
 * getters, long repeated strings devalue would hoist, cycles — falls back
 * to the existing general path unchanged.
 */
export function serializeSmallValueForHydration(value: unknown): string {
  if (isPlainHydratableValue(value)) {
    const fast = emitPlainTree(value);
    if (fast !== undefined) return fast;
  }
  return serializeForHydration(value);
}
