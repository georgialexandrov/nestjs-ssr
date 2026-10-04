import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  compileTemplate,
  fillTemplate,
  injectPlaceholder,
  TEMPLATE_SLOTS,
  type TemplateSlot,
} from '../template.util';

/** What the string renderer did before templates were compiled. */
function chained(template: string, values: Record<TemplateSlot, string>) {
  let html = injectPlaceholder(
    template,
    '<!--app-html-->',
    values['<!--app-html-->'],
  );
  html = injectPlaceholder(
    html,
    '<!--initial-state-->',
    values['<!--initial-state-->'],
  );
  html = injectPlaceholder(
    html,
    '<!--client-scripts-->',
    values['<!--client-scripts-->'],
  );
  html = injectPlaceholder(html, '<!--styles-->', values['<!--styles-->']);
  html = injectPlaceholder(
    html,
    '<!--head-meta-->',
    values['<!--head-meta-->'],
  );
  return html;
}

const packageTemplate = readFileSync(
  join(__dirname, '../../templates/index.html'),
  'utf-8',
);

const templates: Record<string, string> = {
  package: packageTemplate,
  'reordered and without head-meta':
    '<html><body><!--client-scripts--><div><!--app-html--></div><!--styles--><!--initial-state--></body></html>',
  'no placeholders': '<html><body>static</body></html>',
  'a placeholder twice':
    '<head><!--styles--></head><body><!--app-html--><!--styles--></body>',
};

const values: Record<TemplateSlot, string> = {
  '<!--head-meta-->': '<title>Recipes $& $1 $$</title>',
  '<!--styles-->': '<link rel="stylesheet" href="/assets/a.css" />',
  '<!--app-html-->': "<main><h1>Recipes</h1><p>$` and $'</p></main>",
  '<!--initial-state-->':
    '<script>window.__INITIAL_STATE__ = {"a":"\\u003C/script>"};</script>',
  '<!--client-scripts-->': '<script type="module" src="/assets/c.js"></script>',
};

describe('compiled templates', () => {
  it.each(Object.entries(templates))(
    'produce exactly what chained replacement did (%s)',
    (_name, template) => {
      expect(fillTemplate(compileTemplate(template), values)).toBe(
        chained(template, values),
      );
    },
  );

  it('split the package template at every placeholder, in document order', () => {
    const compiled = compileTemplate(packageTemplate);
    expect([...compiled.slots]).toEqual([...TEMPLATE_SLOTS]);
    expect(compiled.parts).toHaveLength(TEMPLATE_SLOTS.length + 1);
  });

  it('never fill a placeholder that appears in the rendered page', () => {
    // A page can emit the comment itself (dangerouslySetInnerHTML). Chained
    // replacement spliced the hydration state into the page content there.
    const page = {
      ...values,
      '<!--app-html-->': '<div><!--initial-state--></div>',
    };
    const html = fillTemplate(compileTemplate(packageTemplate), page);
    expect(html).toContain(
      '<div id="root"><div><!--initial-state--></div></div>',
    );
    expect(html.indexOf(values['<!--initial-state-->'])).toBeGreaterThan(
      html.indexOf('<div><!--initial-state--></div>'),
    );
  });

  it('leave a slot without a value empty', () => {
    expect(
      fillTemplate(compileTemplate('a<!--styles-->b<!--app-html-->c'), {
        '<!--app-html-->': 'X',
      }),
    ).toBe('abXc');
  });
});
