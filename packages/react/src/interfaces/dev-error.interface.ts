/**
 * Diagnostics shown by the development error page. Never produced outside
 * development.
 */

/** One stack frame, resolved to source where a source map allows. */
export interface DevErrorFrame {
  /** Function name, if the frame has one. */
  fn?: string;
  /** Absolute file path (or the raw location when it is not a file). */
  file: string;
  line?: number;
  column?: number;
  /** Relative to the project root, for display. */
  displayPath: string;
  /** Application code, as opposed to dependencies and Node internals. */
  isProject: boolean;
}

export interface DevErrorCodeFrame {
  file: string;
  displayPath: string;
  line: number;
  column?: number;
  lines: Array<{ number: number; text: string }>;
}

/** Everything the development error page can show beyond the error itself. */
export interface DevErrorDetails {
  frames: DevErrorFrame[];
  codeFrame?: DevErrorCodeFrame;
  request?: { method?: string; url?: string };
  /** Opens a file in the developer's editor through the Vite dev server. */
  openInEditorBase?: string;
}
