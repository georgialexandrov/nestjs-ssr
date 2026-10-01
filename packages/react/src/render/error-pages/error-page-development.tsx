import type { ErrorPageDevelopmentProps } from '../../interfaces/render-config.interface';
import { loadedDevTools } from '../dev-tools';

export type { ErrorPageDevelopmentProps } from '../../interfaces/render-config.interface';

/**
 * Default development error page.
 *
 * Renders the full page (source-mapped stack, code frame, request, editor
 * links, light and dark themes) from the development tooling, which
 * development loads at startup. Without it, a compact page with the error
 * and its stack. Never used in production. Override it with
 * `RenderModule.forRoot({ errorPageDevelopment })`.
 */
export function ErrorPageDevelopment(props: ErrorPageDevelopmentProps) {
  const dev = loadedDevTools();
  if (dev) return <dev.DevErrorPage {...props} />;

  const { error, viewPath, phase, nonce } = props;
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="robots" content="noindex" />
        <title>{`${error.name}: ${error.message}`}</title>
        <style
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              'body{font:15px/1.55 system-ui,sans-serif;margin:2rem auto;max-width:960px;padding:0 1.5rem}pre{white-space:pre-wrap;font-size:13px}',
          }}
        />
      </head>
      <body>
        <h1>
          {error.name}: {error.message}
        </h1>
        <p>
          In <code>{viewPath}</code> ({phase})
        </p>
        <pre>{error.stack ?? String(error)}</pre>
      </body>
    </html>
  );
}
