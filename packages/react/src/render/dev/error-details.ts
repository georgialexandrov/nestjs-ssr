import { existsSync, readFileSync } from 'fs';
import { SourceMap } from 'module';
import { dirname, isAbsolute, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { ViteDevServer } from 'vite';

export type {
  DevErrorCodeFrame,
  DevErrorDetails,
  DevErrorFrame,
} from '../../interfaces/dev-error.interface';
import type {
  DevErrorCodeFrame,
  DevErrorDetails,
  DevErrorFrame,
} from '../../interfaces/dev-error.interface';

const FRAME = /^\s*at (?:(.+?) \()?(.+?)(?::(\d+))?(?::(\d+))?\)?$/;

function toPath(location: string): string {
  if (location.startsWith('file://')) {
    try {
      return fileURLToPath(location);
    } catch {
      return location;
    }
  }
  return location;
}

const sourceMaps = new Map<string, SourceMap | null>();

/**
 * Map a location in compiled output (e.g. a tsc-emitted dist/views/x.js) to
 * its source using the `.map` file next to it. Nest's default tsconfig emits
 * those; a process not started with --enable-source-maps never applies them.
 */
function mapToSource(
  file: string,
  line: number,
  column: number,
): { file: string; line: number; column: number } | undefined {
  let map = sourceMaps.get(file);
  if (map === undefined) {
    map = null;
    const mapFile = `${file}.map`;
    if (existsSync(mapFile)) {
      try {
        map = new SourceMap(JSON.parse(readFileSync(mapFile, 'utf-8')));
      } catch {
        map = null;
      }
    }
    sourceMaps.set(file, map);
  }
  if (!map) return undefined;
  const entry = map.findEntry(line - 1, Math.max(0, column - 1)) as {
    originalSource?: string;
    originalLine?: number;
    originalColumn?: number;
  };
  if (!entry?.originalSource || entry.originalLine === undefined) {
    return undefined;
  }
  const source = toPath(entry.originalSource);
  return {
    file: isAbsolute(source) ? source : resolve(dirname(file), source),
    line: entry.originalLine + 1,
    column: (entry.originalColumn ?? 0) + 1,
  };
}

/** Parse and source-map an error's stack. Exported for tests. */
export function resolveFrames(stack: string, root: string): DevErrorFrame[] {
  const frames: DevErrorFrame[] = [];
  for (const raw of stack.split('\n').slice(1)) {
    const match = FRAME.exec(raw);
    if (!match) continue;
    const [, fn, location, lineText, columnText] = match;
    let file = toPath(location);
    let line = lineText ? Number(lineText) : undefined;
    let column = columnText ? Number(columnText) : undefined;
    if (line !== undefined && /\.[cm]?js$/.test(file) && isAbsolute(file)) {
      const mapped = mapToSource(file, line, column ?? 1);
      if (mapped) ({ file, line, column } = mapped);
    }
    const inRoot = isAbsolute(file) && !relative(root, file).startsWith('..');
    const isProject =
      inRoot &&
      !file.includes('/node_modules/') &&
      !file.includes('\\node_modules\\');
    frames.push({
      fn: fn || undefined,
      file,
      line,
      column,
      displayPath: inRoot ? relative(root, file) : file,
      isProject,
    });
  }
  return frames;
}

/** A few lines of source around a frame. Exported for tests. */
export function readCodeFrame(
  frame: DevErrorFrame,
  context = 3,
): DevErrorCodeFrame | undefined {
  if (frame.line === undefined || !existsSync(frame.file)) return undefined;
  let source: string;
  try {
    source = readFileSync(frame.file, 'utf-8');
  } catch {
    return undefined;
  }
  const all = source.split(/\r?\n/);
  const start = Math.max(1, frame.line - context);
  const end = Math.min(all.length, frame.line + context);
  const lines: DevErrorCodeFrame['lines'] = [];
  for (let number = start; number <= end; number++) {
    lines.push({ number, text: all[number - 1] });
  }
  return {
    file: frame.file,
    displayPath: frame.displayPath,
    line: frame.line,
    column: frame.column,
    lines,
  };
}

/**
 * Gather what the development error page shows. Never throws: a diagnostic
 * that fails to resolve is left out rather than hiding the original error.
 */
export function buildDevErrorDetails(
  error: Error,
  options: {
    root: string;
    vite?: ViteDevServer | null;
    vitePort?: number;
    request?: { method?: string; url?: string };
  },
): DevErrorDetails {
  // Stacks from views Vite loaded are already source-mapped: since Vite 6,
  // ssrLoadModule runs through the module runner, which maps them itself.
  // Calling vite.ssrFixStacktrace on top maps them a second time and points
  // at the wrong line, so it is deliberately not used.
  let frames: DevErrorFrame[] = [];
  try {
    frames = resolveFrames(error.stack ?? '', options.root);
  } catch {
    frames = [];
  }
  const first = frames.find((frame) => frame.isProject);
  let codeFrame: DevErrorCodeFrame | undefined;
  try {
    codeFrame = first ? readCodeFrame(first) : undefined;
  } catch {
    codeFrame = undefined;
  }
  return {
    frames,
    codeFrame,
    request: options.request,
    openInEditorBase: options.vitePort
      ? `http://localhost:${options.vitePort}/__open-in-editor?file=`
      : undefined,
  };
}
