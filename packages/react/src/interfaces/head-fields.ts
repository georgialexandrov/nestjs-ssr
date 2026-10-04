/**
 * Declarative description of the fixed `HeadData` fields (title, description,
 * canonical, Open Graph, ...) and the attribute allowlist for the arbitrary
 * `head.links` / `head.meta` entries.
 *
 * This file is the single source of truth both sides of client-side
 * navigation render against:
 * - The server (`TemplateParserService.buildHeadTags`) walks `HEAD_FIELDS` to
 *   turn `HeadData` into the `<title>`/`<meta>`/`<link>` tags in the initial
 *   HTML, and filters custom tags through `ALLOWED_HEAD_ATTRIBUTES`.
 * - The client (`navigate.ts`'s head applier) walks the same `HEAD_FIELDS` to
 *   find, update or remove those same tags after a client-side navigation,
 *   and filters custom tags through the same allowlist.
 *
 * A field added here is rendered by the server and kept in sync by the
 * client with no other code to touch — the two can't drift apart because
 * there is only one list.
 *
 * This module must stay a leaf: no imports from `render`, `react`, or `cli`,
 * so both the server bundle and the browser bundle can depend on it (see
 * `no-server-code-in-client` / `interfaces-stay-leaf` in
 * `.dependency-cruiser.cjs`).
 */

/**
 * One fixed `HeadData` field and how it maps to an HTML element.
 *
 * `title` has no identifying attribute — there is exactly one `<title>` per
 * document. `meta` and `link` fields are identified by a fixed, library-owned
 * attribute/value pair (e.g. `meta[property="og:title"]`), which is what lets
 * both sides find "the" tag for that field without ambiguity.
 */
export interface HeadFieldDescriptor {
  /** The `HeadData` key this field's value comes from. */
  key:
    | 'title'
    | 'description'
    | 'keywords'
    | 'canonical'
    | 'ogTitle'
    | 'ogDescription'
    | 'ogImage';
  /** Which element this field renders as. */
  tag: 'title' | 'meta' | 'link';
  /** Attribute that identifies the tag. Absent for `title`. */
  attr?: 'name' | 'property' | 'rel';
  /** Value of the identifying attribute. Absent for `title`. */
  attrValue?: string;
}

/**
 * The fixed `HeadData` fields, in render order (title and description first,
 * for SEO best practices — order is preserved from before this file existed).
 */
export const HEAD_FIELDS: readonly HeadFieldDescriptor[] = [
  { key: 'title', tag: 'title' },
  { key: 'description', tag: 'meta', attr: 'name', attrValue: 'description' },
  { key: 'keywords', tag: 'meta', attr: 'name', attrValue: 'keywords' },
  { key: 'canonical', tag: 'link', attr: 'rel', attrValue: 'canonical' },
  {
    key: 'ogTitle',
    tag: 'meta',
    attr: 'property',
    attrValue: 'og:title',
  },
  {
    key: 'ogDescription',
    tag: 'meta',
    attr: 'property',
    attrValue: 'og:description',
  },
  { key: 'ogImage', tag: 'meta', attr: 'property', attrValue: 'og:image' },
];

/**
 * Head tag attributes are intentionally allowlisted per element. Merely
 * validating the syntax of an attribute name is not sufficient: names such as
 * `onload` and `onerror` are syntactically valid but execute JavaScript.
 *
 * Enforced on the server when rendering `head.links` / `head.meta` into HTML,
 * and on the client when applying the same data with DOM APIs — one list,
 * so a client-side navigation can never apply an attribute the server would
 * have refused to render.
 */
export const ALLOWED_HEAD_ATTRIBUTES: Record<
  'link' | 'meta',
  ReadonlySet<string>
> = {
  link: new Set(
    'rel,href,as,type,crossorigin,media,integrity,referrerpolicy,sizes,imagesrcset,imagesizes,fetchpriority,hreflang,title'.split(
      ',',
    ),
  ),
  meta: new Set('name,property,content,charset'.split(',')),
};
