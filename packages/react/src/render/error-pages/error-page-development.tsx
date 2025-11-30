export interface ErrorPageDevelopmentProps {
  error: Error;
  viewPath: string;
  phase: 'shell' | 'streaming';
}

/**
 * Default development error page component
 *
 * Shows detailed error information with stack trace
 * App developers can override this by providing their own component
 */
export function ErrorPageDevelopment({
  error,
  viewPath,
  phase,
}: ErrorPageDevelopmentProps) {
  const stackLines = error.stack ? error.stack.split('\n').slice(1) : [];

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>SSR Error - {error.name}</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                padding: 2rem;
                background: #1a1a1a;
                color: #e0e0e0;
              }
              .error-container {
                max-width: 900px;
                margin: 0 auto;
              }
              h1 {
                color: #ff6b6b;
                font-size: 2rem;
                margin-bottom: 0.5rem;
              }
              .error-type {
                color: #ffa502;
                font-size: 1.2rem;
                margin-bottom: 1rem;
              }
              .error-message {
                background: #2d2d2d;
                padding: 1rem;
                border-left: 4px solid #ff6b6b;
                margin: 1rem 0;
                font-family: 'Courier New', Courier, monospace;
              }
              .stack-trace {
                background: #2d2d2d;
                padding: 1rem;
                border-radius: 4px;
                overflow-x: auto;
                margin: 1rem 0;
              }
              .stack-trace pre {
                margin: 0;
                font-family: 'Courier New', Courier, monospace;
                font-size: 0.9rem;
                color: #a0a0a0;
              }
              .meta {
                color: #888;
                font-size: 0.9rem;
                margin-top: 2rem;
              }
            `,
          }}
        />
      </head>
      <body>
        <div className="error-container">
          <h1>Server-Side Rendering Error</h1>
          <div className="error-type">{error.name}</div>
          <div className="error-message">{error.message}</div>

          <h2>Stack Trace</h2>
          <div className="stack-trace">
            <pre>{stackLines.join('\n')}</pre>
          </div>

          <div className="meta">
            <p>
              <strong>View Path:</strong> {viewPath}
            </p>
            <p>
              <strong>Error Phase:</strong>{' '}
              {phase === 'shell'
                ? 'Shell (before streaming started)'
                : 'Streaming (during content delivery)'}
            </p>
            <p>
              <strong>Environment:</strong> Development
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
