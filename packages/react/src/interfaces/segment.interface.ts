import type { HeadData } from './render-response.interface';
import type { RenderContext } from './render-context.interface';

/**
 * Response format for segment rendering (client-side navigation).
 * Returned when a GET request includes the X-Current-Layouts header.
 */
export interface SegmentResponse {
  /** The rendered HTML for the segment (content below swapTarget layout) */
  html: string;
  /** Head metadata to update (title, description, etc.) */
  head?: HeadData;
  /** Component props for hydration */
  props: any;
  /** Which outlet to swap (the deepest common layout). Null if no common ancestor. */
  swapTarget: string | null;
  /** Component name for resolving in module registry during hydration */
  componentName: string;
  /** Page context for updating hooks (path, params, query, etc.) */
  context?: RenderContext;
}
