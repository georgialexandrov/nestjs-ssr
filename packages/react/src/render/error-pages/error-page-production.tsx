/**
 * Default production error page component
 *
 * Shows generic error message without sensitive details
 * App developers can override this by providing their own component
 */
export function ErrorPageProduction() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Error</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: #f5f5f5;
              }
              .error-container {
                text-align: center;
                padding: 2rem;
              }
              h1 {
                font-size: 3rem;
                color: #333;
                margin: 0 0 1rem 0;
              }
              p {
                font-size: 1.2rem;
                color: #666;
              }
            `,
          }}
        />
      </head>
      <body>
        <div className="error-container">
          <h1>500</h1>
          <p>Internal Server Error</p>
          <p>Something went wrong while rendering this page.</p>
        </div>
      </body>
    </html>
  );
}
