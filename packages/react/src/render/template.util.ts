/**
 * Replace a template placeholder with content.
 *
 * Uses a replacer function instead of a replacement string: String.replace
 * interprets `$&`, `$'` etc. in replacement strings, which would let
 * user-influenced content (serialized state, rendered HTML) splice template
 * fragments into the output.
 *
 * Shared by both renderers so the placeholder-injection semantics cannot
 * drift between string and stream mode.
 */
export function injectPlaceholder(
  html: string,
  placeholder: string,
  content: string,
): string {
  return html.replace(placeholder, () => content);
}
