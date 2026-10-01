import type {
  DevErrorDetails,
  DevErrorFrame,
} from '../../interfaces/dev-error.interface';
import type { ErrorPageDevelopmentProps } from '../../interfaces/render-config.interface';

const STYLES = `
:root {
  color-scheme: light dark;
  --bg: #fafafa; --panel: #ffffff; --text: #1f2328; --muted: #656d76;
  --border: #d0d7de; --accent: #cf222e; --accent-soft: #ffebe9;
  --code-bg: #f6f8fa; --highlight: #fff8c5; --link: #0969da;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1117; --panel: #161b22; --text: #e6edf3; --muted: #8d96a0;
    --border: #30363d; --accent: #ff7b72; --accent-soft: #3d1a1a;
    --code-bg: #0d1117; --highlight: #3b3417; --link: #58a6ff;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 15px/1.55 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
main { max-width: 960px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }
.badge {
  display: inline-block; font-size: 12px; font-weight: 600; letter-spacing: .04em;
  text-transform: uppercase; color: var(--accent); background: var(--accent-soft);
  border-radius: 999px; padding: .15rem .6rem;
}
h1 { font-size: 1.6rem; line-height: 1.25; margin: .75rem 0 .25rem; word-break: break-word; }
.name { color: var(--accent); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.where { color: var(--muted); margin: 0 0 1.5rem; }
section {
  background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
  margin: 1rem 0; overflow: hidden;
}
section > header {
  display: flex; justify-content: space-between; align-items: center; gap: 1rem;
  padding: .6rem 1rem; border-bottom: 1px solid var(--border); font-weight: 600;
}
section > header .meta { font-weight: 400; color: var(--muted); font-size: 13px; }
pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
.frame-code { margin: 0; padding: .5rem 0; background: var(--code-bg); overflow-x: auto; }
.frame-code .ln { display: flex; }
.frame-code .ln.hit { background: var(--highlight); }
.frame-code .no { user-select: none; color: var(--muted); text-align: right; width: 3.5rem; padding-right: 1rem; flex: none; }
.frame-code .src { white-space: pre; padding-right: 1rem; }
ol.stack { list-style: none; margin: 0; padding: .25rem 0; }
ol.stack li { padding: .3rem 1rem; display: flex; gap: .75rem; flex-wrap: wrap; }
ol.stack li.dep { color: var(--muted); }
ol.stack li .fn { font-weight: 600; }
ol.stack li.dep .fn { font-weight: 400; }
a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: .35rem 1.25rem; margin: 0; padding: .75rem 1rem; }
dt { color: var(--muted); }
dd { margin: 0; word-break: break-all; }
button {
  font: inherit; font-size: 13px; cursor: pointer; color: var(--text);
  background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px; padding: .25rem .7rem;
}
details summary { cursor: pointer; padding: .3rem 1rem; color: var(--muted); }
.hint { color: var(--muted); font-size: 13px; }
`;

const COPY_SCRIPT = `
document.getElementById('copy-report')?.addEventListener('click', function () {
  var report = document.getElementById('error-report');
  if (!report || !navigator.clipboard) return;
  navigator.clipboard.writeText(report.textContent || '').then(
    () => { this.textContent = 'Copied'; },
    () => { this.textContent = 'Copy failed'; },
  );
});
`;

function location(frame: DevErrorFrame): string {
  return frame.line === undefined
    ? frame.displayPath
    : `${frame.displayPath}:${frame.line}${frame.column ? `:${frame.column}` : ''}`;
}

function editorHref(
  details: DevErrorDetails | undefined,
  frame: { file: string; line?: number; column?: number },
): string | undefined {
  if (!details?.openInEditorBase || frame.line === undefined) return undefined;
  return (
    details.openInEditorBase +
    encodeURIComponent(
      `${frame.file}:${frame.line}${frame.column ? `:${frame.column}` : ''}`,
    )
  );
}

function plainReport(
  error: Error,
  viewPath: string,
  phase: string,
  details?: DevErrorDetails,
): string {
  const lines = [
    `${error.name}: ${error.message}`,
    `View: ${viewPath} (${phase})`,
  ];
  if (details?.request?.url) {
    lines.push(
      `Request: ${details.request.method ?? 'GET'} ${details.request.url}`,
    );
  }
  lines.push('', error.stack ?? '');
  return lines.join('\n');
}

/**
 * The full development error page, rendered by `ErrorPageDevelopment` once
 * the development tooling is loaded.
 *
 * Self-contained (inline styles, no external requests) and never used in
 * production.
 */
export function DevErrorPage({
  error,
  viewPath,
  phase,
  details,
  nonce,
}: ErrorPageDevelopmentProps) {
  const frames = details?.frames ?? [];
  const project = frames.filter((frame) => frame.isProject);
  const dependencies = frames.filter((frame) => !frame.isProject);
  const code = details?.codeFrame;
  const codeHref = code ? editorHref(details, code) : undefined;
  const phaseText =
    phase === 'shell'
      ? 'while rendering the page'
      : 'while streaming the page (the response had already started)';

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="robots" content="noindex" />
        <title>{`${error.name}: ${error.message}`}</title>
        <style nonce={nonce} dangerouslySetInnerHTML={{ __html: STYLES }} />
      </head>
      <body>
        <main>
          <span className="badge">Server rendering error · development</span>
          <h1>
            <span className="name">{error.name}</span> {error.message}
          </h1>
          <p className="where">
            In <code>{viewPath}</code> {phaseText}
            {details?.request?.url
              ? ` — ${details.request.method ?? 'GET'} ${details.request.url}`
              : ''}
          </p>

          {code && (
            <section>
              <header>
                <span>
                  {codeHref ? (
                    <a href={codeHref} title="Open in editor">
                      {location({ ...code, isProject: true })}
                    </a>
                  ) : (
                    location({ ...code, isProject: true })
                  )}
                </span>
                {codeHref && (
                  <span className="meta">click to open in your editor</span>
                )}
              </header>
              <pre className="frame-code">
                {code.lines.map((line) => (
                  <div
                    key={line.number}
                    className={line.number === code.line ? 'ln hit' : 'ln'}
                  >
                    <span className="no">{line.number}</span>
                    <span className="src">{line.text || ' '}</span>
                  </div>
                ))}
              </pre>
            </section>
          )}

          <section>
            <header>
              <span>Stack</span>
              <button type="button" id="copy-report">
                Copy error report
              </button>
            </header>
            {frames.length > 0 ? (
              <>
                <ol className="stack">
                  {project.map((frame, index) => {
                    const href = editorHref(details, frame);
                    return (
                      <li key={`p${index}`}>
                        <span className="fn">{frame.fn ?? '(anonymous)'}</span>
                        {href ? (
                          <a href={href}>{location(frame)}</a>
                        ) : (
                          <code>{location(frame)}</code>
                        )}
                      </li>
                    );
                  })}
                </ol>
                {dependencies.length > 0 && (
                  <details>
                    <summary>
                      {dependencies.length} frames in dependencies and Node.js
                    </summary>
                    <ol className="stack">
                      {dependencies.map((frame, index) => (
                        <li key={`d${index}`} className="dep">
                          <span className="fn">
                            {frame.fn ?? '(anonymous)'}
                          </span>
                          <code>{location(frame)}</code>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </>
            ) : (
              <pre className="frame-code" style={{ padding: '.75rem 1rem' }}>
                {error.stack ?? String(error)}
              </pre>
            )}
          </section>

          <p className="hint">
            This page is shown only in development. Production renders the
            generic error page without any of these details.
          </p>

          <pre id="error-report" hidden>
            {plainReport(error, viewPath, phase, details)}
          </pre>
        </main>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: COPY_SCRIPT }}
        />
      </body>
    </html>
  );
}
