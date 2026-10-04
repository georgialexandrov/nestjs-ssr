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

/**
 * Append route preload tags to the stylesheet tags. With no route tags (every
 * eager-registry app) the result is the stylesheet tags unchanged.
 */
export function withRouteAssets(styles: string, routeAssets: string): string {
  if (!routeAssets) return styles;
  return styles ? `${styles}\n    ${routeAssets}` : routeAssets;
}

/** Placeholders a page template can contain, as the renderers fill them. */
export const TEMPLATE_SLOTS = [
  '<!--head-meta-->',
  '<!--styles-->',
  '<!--app-html-->',
  '<!--initial-state-->',
  '<!--client-scripts-->',
] as const;

export type TemplateSlot = (typeof TEMPLATE_SLOTS)[number];

/**
 * A template split once into its static text and the placeholders between.
 * `parts` has one more entry than `slots`.
 */
export interface CompiledTemplate {
  readonly source: string;
  readonly parts: readonly string[];
  readonly slots: readonly TemplateSlot[];
}

/**
 * Split a template at the first occurrence of each placeholder.
 *
 * Filling a compiled template concatenates each part once. Chained
 * `injectPlaceholder` calls instead rescanned and copied the whole page per
 * placeholder, rendered HTML included, which was the largest single cost of
 * a string-mode render. It also means a placeholder is only ever matched in
 * the template: a page whose own HTML contains `<!--initial-state-->` no
 * longer has the hydration state spliced into it. For any other page the
 * output is byte-for-byte the same.
 */
export function compileTemplate(source: string): CompiledTemplate {
  const found = TEMPLATE_SLOTS.map((slot) => ({
    slot,
    index: source.indexOf(slot),
  }))
    .filter(({ index }) => index !== -1)
    .sort((a, b) => a.index - b.index);
  const parts: string[] = [];
  let position = 0;
  for (const { slot, index } of found) {
    parts.push(source.slice(position, index));
    position = index + slot.length;
  }
  parts.push(source.slice(position));
  return { source, parts, slots: found.map(({ slot }) => slot) };
}

/** Fill a compiled template; a slot without a value is left empty. */
export function fillTemplate(
  template: CompiledTemplate,
  values: Partial<Record<TemplateSlot, string>>,
): string {
  let html = template.parts[0];
  for (let index = 0; index < template.slots.length; index++) {
    html += (values[template.slots[index]] ?? '') + template.parts[index + 1];
  }
  return html;
}
