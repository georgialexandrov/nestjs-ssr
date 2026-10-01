import escapeHtml from 'escape-html';
import { uneval } from 'devalue';

/**
 * Overlay written into a streamed response when rendering fails after the
 * response has started, so the error is visible in development.
 */
export function devErrorOverlay(
  error: Error,
  viewPath: string,
  nonce?: string,
): string {
  const errorMessage = escapeHtml(error.message);
  const errorStack = escapeHtml(error.stack || '');
  const escapedViewPath = escapeHtml(viewPath);
  return `
<div id="ssr-error-overlay" style="
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 14px;
  padding: 32px;
  overflow: auto;
">
  <div style="max-width: 900px; margin: 0 auto;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
      <span style="font-size: 32px;">⚠️</span>
      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ff6b6b;">
        SSR Streaming Error
      </h1>
    </div>
    <p style="color: #aaa; margin-bottom: 16px;">
      An error occurred after streaming started in <code style="background: #333; padding: 2px 6px; border-radius: 4px;">${escapedViewPath}</code>
    </p>
    <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <div style="color: #ff6b6b; font-weight: 600; margin-bottom: 8px;">Error Message:</div>
      <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; color: #fff;">${errorMessage}</pre>
    </div>
    <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 16px;">
      <div style="color: #888; font-weight: 600; margin-bottom: 8px;">Stack Trace:</div>
      <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; color: #888; font-size: 12px;">${errorStack}</pre>
    </div>
    <button id="ssr-error-dismiss" type="button" style="
      margin-top: 24px;
      background: #333;
      color: #fff;
      border: 1px solid #555;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
    ">Dismiss</button>
  </div>
</div>
<script${nonce ? ` nonce="${escapeHtml(nonce)}"` : ''}>
document.getElementById('ssr-error-dismiss')?.addEventListener('click', () => {
  document.getElementById('ssr-error-overlay')?.remove();
});
console.error('SSR Streaming Error in ' + ${uneval(viewPath)} + ':', ${uneval(error.message)});
</script>
`;
}
