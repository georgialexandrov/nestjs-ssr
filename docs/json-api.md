# JSON API Mode

Same route, two formats. When a request includes `Accept: application/json`, the controller's data is returned as JSON instead of rendering React. Browsers get HTML, API clients get JSON.

Use it when the page data should also be consumable by mobile clients, CLIs, tests, or AI agents. You keep a single controller and route instead of duplicating the same query logic in a parallel REST endpoint.

## Configuration

Enable globally:

```typescript
RenderModule.forRoot({
  jsonApi: true,
});
```

Disable on specific routes:

```typescript
@Get('admin')
@Render(AdminDashboard, { jsonApi: false })
getAdmin() {
  return { stats: this.statsService.get() };
}
```

Enable on a single route (module default stays `false`):

```typescript
@Get('products')
@Render(ProductList, { jsonApi: true })
getProducts() {
  return { products: this.productService.findAll() };
}
```

Resolution order: route-level `jsonApi` > module-level `jsonApi` > `false`.

## Usage

Request JSON from any enabled route:

```bash
curl -H "Accept: application/json" http://localhost:3000/recipes
```

Response:

```json
{ "recipes": [...], "total": 42 }
```

The response body is the exact object the controller returns — no wrapper, no metadata. The same shape the React component receives as props.

No extra route is created. `GET /recipes` still returns HTML by default. JSON is only returned when the client explicitly asks for it.

## What gets serialized

Simple controller return:

```typescript
@Get()
@Render(RecipeList)
getRecipes() {
  return { recipes: this.recipeService.findAll(), total: 42 };
}
```

JSON response:

```json
{ "recipes": [...], "total": 42 }
```

If the controller returns `RenderResponse`, JSON mode still serializes only `props`. Rendering-only fields like `head` and `layoutProps` are ignored:

```typescript
return {
  props: { recipes, total },
  head: { title: 'Recipes' },
};
```

JSON response:

```json
{ "recipes": [...], "total": 42 }
```

## Behavior

| Accept header         | jsonApi enabled | Result                  |
| --------------------- | --------------- | ----------------------- |
| `text/html` or absent | any             | HTML (normal rendering) |
| `application/json`    | `true`          | JSON response           |
| `application/json`    | `false`         | 406 Not Acceptable      |

When a JSON request hits a route where `jsonApi` is disabled, the response is:

```json
{
  "error": "Not Acceptable",
  "message": "JSON response not available for this route"
}
```

## Client-side navigation

Requests with the `X-Current-Layouts` header (sent by the built-in `Link` component for client-side navigation) are always treated as segment requests, even if `Accept: application/json` is present. JSON API mode does not interfere with navigation.

## Adapter support

The JSON response path works with both Express and Fastify. The same `Accept` header triggers content negotiation in both adapters, and the response content type is explicitly set to `application/json`.

## What this is not

- Not a REST API framework. No filtering, pagination, or field selection — the controller controls the shape.
- Not GraphQL. You get the full props object.
- No authentication built in. Use NestJS guards for that.
