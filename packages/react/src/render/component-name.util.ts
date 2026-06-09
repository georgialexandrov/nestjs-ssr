/**
 * Fallback name for layouts without a displayName or function name.
 *
 * IMPORTANT: This must match the `|| 'Layout'` fallback in the entry
 * templates (entry-server.tsx / entry-client.tsx), which stamp it into
 * data-layout attributes. The client echoes those names back in the
 * X-Current-Layouts header, so every producer and consumer of layout
 * names has to agree on the fallback or segment matching silently fails.
 */
export const LAYOUT_NAME_FALLBACK = 'Layout';

/**
 * Shape of a component name we could have produced: visible letters and
 * digits (any script), plus the characters that appear in identifiers and
 * view filenames (`_ . $ -`). Deliberately excludes whitespace, control,
 * and invisible/format characters (zero-width joiners, BiDi overrides),
 * so a client-supplied name that "looks" legitimate cannot smuggle
 * invisible tokens past the comparison logic.
 */
const VALID_COMPONENT_NAME = /^[\p{L}\p{N}_.$-]{1,128}$/u;

/**
 * Whether a client-supplied string is a plausible component name.
 * Used to validate the X-Current-Layouts header, which is client-controlled.
 */
export function isValidComponentName(name: string): boolean {
  return VALID_COMPONENT_NAME.test(name);
}

/**
 * Resolve a stable display name for a component.
 *
 * Used for layout identity (segment swap targets, dedupe, data-layout
 * attributes) and client-side module resolution. Production bundles are
 * minified, so `Function.name` is unreliable there - components that
 * participate in client-side navigation should set `displayName`.
 */
export function getComponentName(
  component: { displayName?: string; name?: string } | null | undefined,
  fallback = 'Component',
): string {
  return component?.displayName || component?.name || fallback;
}

/**
 * Resolve the display name of a layout component.
 * Always uses LAYOUT_NAME_FALLBACK so server-side layout names line up with
 * the data-layout attributes the entry templates render.
 */
export function getLayoutName(
  component: { displayName?: string; name?: string } | null | undefined,
): string {
  return getComponentName(component, LAYOUT_NAME_FALLBACK);
}

/**
 * Serialize layout metadata (names and props, never functions) for the
 * client hydration payload and segment responses.
 */
export function serializeLayoutMetadata(
  layouts?: Array<{ layout: any; props?: any }>,
): Array<{ name: string; props?: any }> {
  if (!layouts) {
    return [];
  }
  return layouts.map((l) => ({
    name: getLayoutName(l.layout),
    props: l.props,
  }));
}
