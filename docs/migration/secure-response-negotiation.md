# Adopting the response pipeline

This release rebuilds the rendered-response path. `@Render()` used to decide six
things in one interceptor — what a controller value meant, what request data was
client-visible, whether a request wanted JSON (by substring match), how layouts
resolved, and how to write an adapter-specific response. Those are now separate
stages you can reason about one at a time.

**Nothing in this release changes what a working application serves.** There is
no migration to perform. Everything below is either new capability you can opt
into, or a diagnostic telling you what a future release will enforce.

The defaults that _should_ change — conservative caching, correct `Accept`
ranking, enforced payload limits — are deliberately held back. They change bytes
on the wire, so they ride with the next breaking release rather than arriving
under a patch.

## What you get without changing anything

- **Distinct HTML and JSON payloads** are now expressible (below).
- **`timeout` finally does something.** It was accepted and effectively
  inert; a render now gets a real `AbortSignal`, and abort-aware work stops
  when the client disconnects or the deadline passes.
- **Client-side navigation validates segments** before applying them — schema
  version, size, and whether the swap target exists in the current layout tree
  — and writes them through a single Trusted Types sink. A response that fails
  any check becomes a full navigation instead of a partly applied fragment.
- **Credential headers can no longer leak** into the render context, even if
  `allowedHeaders` names one.
- **Express and Fastify actually behave identically**, including a fixed bug
  where `Vary` lost its first field on Fastify.
- **Payload diagnostics.** Anything that will fail once limits are enforced is
  logged now, with the property path and never the value.

## Distinct payloads per representation

Page props are a view model; an API body is a contract. When they should differ:

```typescript
import { Render, api, page, representations } from '@nestjs-ssr/react';

@Get(':slug')
@Render(RecipeDetail)
getRecipe(@Param('slug') slug: string) {
  const recipe = this.recipes.findBySlug(slug);
  const chef = this.chefs.findById(recipe.chefId);

  return representations({
    html: page({ props: { recipe, chef }, head: { title: recipe.name } }),
    json: api(() => ({ slug: recipe.slug, chef: chef.name })),
  });
}
```

`html` and `json` keep independent static types, and only the representation the
request negotiates is built — passing a function defers the work entirely.

Plain props and `RenderResponse` keep working exactly as before.

## Narrowing the render context

Whatever your `context` factory returns is serialized into the page. If it hands
over a domain object, this hook is where you narrow it — and it applies to HTML
hydration, JSON, and segments alike:

```typescript
RenderModule.forRoot({
  context: ({ req }) => ({ user: req.user }),
  projectContext: ({ context }) => ({
    ...context,
    user: context.user && { id: context.user.id, name: context.user.name },
  }),
});
```

## Request headers now live in a bag

Allowed headers are available at `context.headers['x-tenant-id']` rather than
`context['x-tenant-id']`, so a header named `path` can no longer shadow the URL.

The top-level properties are still written, so nothing breaks. `useHeader()` and
`useHeaders()` read the bag and fall back to the old shape. The aliases are
deprecated and go away in the next major — moving your reads to `context.headers`
now costs nothing.

## Payload limits: warned, not enforced

Client-visible payloads are checked against the same rules the serializers
actually have. A payload is _reported_ — never refused — when it contains a
function, a symbol, an un-awaited promise, binary data, or a prototype-polluting
key; when it exceeds 2 MiB or 64 levels of nesting; or, for JSON specifically,
when it holds a `Map`, `Set`, `RegExp`, `bigint`, or a cycle that JSON cannot
represent.

The report names the property path and never its value:

```
Cannot serialize props: functions cannot cross the response boundary at
props.user.onClick. This is allowed through because representation.limits.mode
is 'warn'; it will be refused once the mode is 'enforce'.
```

Run on `warn` — the default — long enough to see whether anything real trips it.
When your logs are quiet, turn it on:

```typescript
RenderModule.forRoot({
  representation: { limits: { mode: 'enforce' } },
});
```

Per-route, and tightenable but never raisable above the module's limit:

```typescript
@Render(Widget, {
  representation: { limits: { mode: 'enforce', maxBytes: 32 * 1024 } },
})
```

## Response headers: available, off by default

The pipeline can apply a cache stance and security headers, and composes them
with whatever your middleware already set — it never overwrites a header the
application provided. It emits nothing at all until you ask:

```typescript
RenderModule.forRoot({
  representation: {
    cache: { visibility: 'private' }, // Cache-Control: private, no-store
    securityHeaders: { referrerPolicy: 'no-referrer' },
  },
});
```

Declaring either one turns the stage on for that scope. A route can opt into
public caching, and its cache keys are combined with the headers negotiation
already depends on:

```typescript
@Render(PublicPage, {
  representation: {
    cache: { visibility: 'public', maxAge: 300, keys: ['Accept-Language'] },
  },
})
```

`Vary` itself is unchanged — `Accept` and `X-Current-Layouts` were always sent.

## `jsonApi` → `representation`

`jsonApi` is now a deprecated alias for `representation.json`. It still works and
still serves page props as the JSON body, with a development-only warning.

```typescript
// Before
RenderModule.forRoot({ jsonApi: true });
@Render(Page, { jsonApi: false })

// After
RenderModule.forRoot({ representation: { json: true } });
@Render(Page, { representation: { json: false } })
```

The change is mechanical:

```bash
rg -l 'jsonApi:' src | xargs sed -i '' \
  -e 's/jsonApi: true/representation: { json: true }/' \
  -e 's/jsonApi: false/representation: { json: false }/'
```

Review the results — a route that already has a `representation` key needs the
flag merged into it rather than added beside it.

## Raw controller strings

A `@Render()` route that returns a string bypasses the pipeline entirely:
nothing is projected, measured, or policy-checked. It still works, with a
development warning, and fails in the next major.

```typescript
// Before
@Get('legacy')
@Render(Page)
getLegacy() { return this.renderer.toHtml(); }

// After: a plain route, no @Render()
@Get('legacy')
@Header('Content-Type', 'text/html')
getLegacy() { return this.renderer.toHtml(); }
```

Adopt that behaviour early with `RenderModule.forRoot({ legacyCompatibility: false })`.

## What changes in the next breaking release

Held back deliberately, so you can plan for them:

|                                   | Today                                    | Next                                                                               |
| --------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `Accept` ranking                  | JSON wins whenever the client accepts it | Quality and specificity decide, so `text/html, application/json;q=0.5` serves HTML |
| `406` body                        | `{ error, message }`                     | Adds `statusCode` and the media types the route can produce                        |
| Segment content type              | `application/json`                       | `application/vnd.nestjs-ssr.segment+json`                                          |
| Cache and security headers        | off unless configured                    | conservative defaults on                                                           |
| Payload limits                    | reported                                 | enforced                                                                           |
| Header aliases                    | written alongside the bag                | removed                                                                            |
| Raw strings on `@Render()` routes | deprecated, still work                   | rejected                                                                           |

Three of those you can adopt today: enforce limits with `limits.mode`, turn on
response headers by configuring `cache`/`securityHeaders`, and reject raw
strings with `legacyCompatibility: false`.
