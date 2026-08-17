/**
 * Extract a human-readable message from an unknown thrown value.
 *
 * `catch (error: any)` silently permits `error.message` on anything, including
 * the strings and plain objects that libraries and rejected promises do throw.
 * Narrowing here keeps the catch clauses typed as `unknown` — which is what
 * they actually are — while still producing a useful message.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}
