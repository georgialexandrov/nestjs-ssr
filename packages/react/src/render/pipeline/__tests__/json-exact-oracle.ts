/**
 * Semantic oracle for the JSON-exact hydration fast path.
 *
 * The fast path gives up devalue's byte-identical output for JSON-exact
 * trees, so the fallback-path guarantee ("output is exactly
 * `devalue.uneval(value)`") no longer applies to them. What must still hold
 * is that the two expressions evaluate to indistinguishable values: this
 * evaluates both in the calling realm (so `Object.prototype`, `Array.prototype`
 * etc. are the very same objects, not look-alikes from a separate `vm`
 * context) and compares structure, key order and prototypes recursively.
 */
import { isDeepStrictEqual } from 'node:util';

/**
 * Evaluate a serialized hydration expression (JSON-exact or devalue output)
 * in this realm. `new Function` (unlike `vm.runInNewContext`) shares
 * prototypes with the caller, so `instanceof`/`Object.getPrototypeOf` checks
 * against `Object.prototype` and `Array.prototype` are meaningful.
 */
export function evalInRealm(source: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(`return (${source})`)() as unknown;
}

/**
 * Assert `actual` and `expected` are indistinguishable: same value at every
 * leaf (`util.isDeepStrictEqual`, which also catches NaN/-0/type
 * differences), same `Object.keys` order at every level, and the same
 * prototype at every level (so a JSON object literal masquerading as a
 * null-prototype or class-shaped object would be caught).
 */
export function assertSameShape(
  actual: unknown,
  expected: unknown,
  path = '$',
): void {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(
      `${path}: values differ\n  actual:   ${describe(actual)}\n  expected: ${describe(expected)}`,
    );
  }
  if (typeof actual !== 'object' || actual === null) return;
  if (typeof expected !== 'object' || expected === null) return;

  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) {
    throw new Error(`${path}: prototypes differ`);
  }
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error(
      `${path}: key order differs\n  actual:   [${actualKeys.join(', ')}]\n  expected: [${expectedKeys.join(', ')}]`,
    );
  }
  for (const key of actualKeys) {
    assertSameShape(
      (actual as Record<string, unknown>)[key],
      (expected as Record<string, unknown>)[key],
      `${path}.${key}`,
    );
  }
}

function describe(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Characters an inline `<script>` cannot safely contain unescaped. Built with
 * `fromCharCode` rather than a ` `/` ` literal so this file itself
 * contains no raw line/paragraph separator (which would otherwise be an
 * invisible, easy-to-mismatch character sitting in the source).
 */
export const SCRIPT_UNSAFE_CHARS = [
  '<',
  String.fromCharCode(0x2028),
  String.fromCharCode(0x2029),
];

/** Whether `text` contains any character unsafe to inline into a `<script>` body. */
export function containsScriptUnsafeChar(text: string): boolean {
  return SCRIPT_UNSAFE_CHARS.some((char) => text.includes(char));
}
