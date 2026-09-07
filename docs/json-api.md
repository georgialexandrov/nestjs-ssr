# Representations & JSON API

Same route, several formats. A rendered route can serve an HTML page, a JSON body, and a client-navigation segment from one controller action, and the framework decides which one to produce from the request's `Accept` header.

Use it when the page data should also be consumable by mobile clients, CLIs, tests, or AI agents. You keep a single controller and route instead of duplicating the same query logic in a parallel REST endpoint.

## Enabling JSON

Rendered routes serve HTML only until you say otherwise. Enable JSON for every route:

```typescript
RenderModule.forRoot({
  representation: { json: true },
});
```

Or for one route:

```typescript
@Get('products')
@Render(ProductList, { representation: { json: true } })
getProducts() {
  return { products: this.productService.findAll() };
}
```

Or disable it for one route when the module enables it:

```typescript
@Get('admin')
@Render(AdminDashboard, { representation: { json: false } })
getAdmin() {
  return { stats: this.statsService.get() };
}
```

Availability resolves in this order: the controller's explicit result, route policy, module policy, the deprecated `jsonApi` aliases, then HTML-only. A route that explicitly sets `json: false` always wins — turning a representation off is a deliberate exposure decision.

## Same payload for both

When the page props are already a public view model, that object serves both representations. Nothing extra to write:

```typescript
@Get()
@Render(RecipeList)
getRecipes() {
  return { recipes: this.recipes.findAll(), total: 42 };
}
```

```bash
curl http://localhost:3000/recipes                                # HTML
curl -H 'Accept: application/json' http://localhost:3000/recipes  # JSON
```

```json
{ "recipes": [...], "total": 42 }
```

## Different payloads per representation

Page props are a view model; an API body is a contract. When they should differ, say so explicitly:

```typescript
import { Render, api, page, representations } from '@nestjs-ssr/react';

@Get(':slug')
@Render(RecipeDetail)
getRecipe(@Param('slug') slug: string) {
  const recipe = this.recipes.findBySlug(slug);
  const chef = this.chefs.findById(recipe.chefId);

  return representations({
    // The page needs the chef object to render a byline.
    html: page({
      props: { recipe, chef },
      head: { title: recipe.name },
    }),
    // The API contract is flat, with just the chef's name.
    json: api(() => ({
      slug: recipe.slug,
      name: recipe.name,
      chef: chef.name,
    })),
  });
}
```

`html` and `json` keep independent static types — the JSON DTO is not constrained by the component's props. Only the negotiated representation is built and serialized; passing a function to `page()` or `api()` defers the work until that branch is actually selected.

A route can offer JSON alone:

```typescript
@Get('feed')
@Render(FeedPage)
getFeed() {
  return api({ items: this.feed.latest() });
}
```

A request for `text/html` on that route gets a `406`.

`api()` can declare its own media type, which is then what the response carries:

```typescript
return api(dto, { mediaType: 'application/vnd.acme.recipe+json' });
```

A domain object that happens to have `html` or `json` properties is not mistaken for a representation envelope — only values built by these factories are treated as framework control data.

## How the format is chosen

JSON is served when the client explicitly asks for it — by naming
`application/json`, or a `application/*+json` media type the route offers. A
wildcard is not asking: `*/*`, a missing header, and the `Accept` a browser
sends all mean "whatever you have", which is HTML.

| Request                                   | Result                          |
| ----------------------------------------- | ------------------------------- |
| No `Accept`, or `*/*`, or `application/*` | HTML                            |
| `text/html`                               | HTML                            |
| `application/json`                        | JSON, when enabled              |
| `text/html, application/json`             | JSON — see below                |
| `application/json;q=0`                    | HTML — JSON was excluded        |
| `application/*+json`                      | The JSON representation         |
| `image/png`                               | HTML — the page is still served |
| `application/json`, JSON not enabled      | `406 Not Acceptable`            |

A request that accepts both currently resolves to JSON regardless of the quality
weights, which is what previous releases did. Ranking by quality and specificity
is the correct behaviour and is a documented default change, so it lands with
the next breaking release — at which point `text/html, application/json;q=0.5`
will serve HTML.

A malformed media range is ignored rather than failing the request, and a route
never refuses an `Accept` header it cannot satisfy exactly — only an explicit
request for a representation the route does not offer is a `406`:

```json
{
  "error": "Not Acceptable",
  "message": "JSON response not available for this route"
}
```

Every rendered response carries `Vary: Accept`, plus `X-Current-Layouts` when
client navigation is on, so shared caches keep the variants apart.

## Client-side navigation

Requests carrying a valid `X-Current-Layouts` header are always handled as segment requests, even when they also accept JSON — that header is the library's own navigation protocol. Segments are derived from the **HTML** representation, so a JSON DTO is never served as a navigation payload.

## Adapter support

Negotiation, status codes, media types, and cache headers behave identically on Express and Fastify. Only the response writer knows which adapter is in use.

## Migrating from `jsonApi`

`jsonApi: true` still works and still serves the page props as the JSON body, with a development-only warning. See the [migration guide](/migration/secure-response-negotiation) for the mapping.

## What this is not

- Not a REST API framework. No filtering, pagination, or field selection — the controller controls the shape.
- Not GraphQL. You get exactly the DTO you returned.
- No authentication built in. Use NestJS guards for that; this library decides what to serialize after a guard has passed.
