## 1. Configuration

- [ ] 1.1 Add `jsonApi?: boolean` to `RenderConfig` interface (`packages/react/src/interfaces/render-config.interface.ts`)
- [ ] 1.2 Add `jsonApi?: boolean` to `RenderOptions` interface (`packages/react/src/decorators/react-render.decorator.ts`)
- [ ] 1.3 Register `JSON_API` injection token in `RenderModule.forRoot()` and `forRootAsync()` (`packages/react/src/render/render.module.ts`)

## 2. Content Negotiation in Interceptor

- [ ] 2.1 Add `isJsonRequest()` helper method to `RenderInterceptor` — checks `Accept: application/json`
- [ ] 2.2 Add `isJsonApiEnabled()` method — resolves route-level `jsonApi` → module-level `jsonApi` → `false`
- [ ] 2.3 Add JSON API branch in `intercept()` after response normalization and before segment detection: if JSON requested + enabled → return controller data directly with `application/json` content type
- [ ] 2.4 Add 406 branch: if JSON requested + disabled → throw `NotAcceptableException` with `{ error: "Not Acceptable", message: "JSON response not available for this route" }`
- [ ] 2.5 Add segment priority guard: skip JSON API path if `X-Current-Layouts` header is present

## 3. Types

- [ ] 3.1 Export `JsonApiResponse<T>` TypeScript interface from the library's public API (generic over the controller return type)

## 4. Tests

- [ ] 4.1 Unit test: `isJsonRequest()` with Accept header present, absent, and other values
- [ ] 4.2 Unit test: `isJsonApiEnabled()` resolution — route override > module config > default false
- [ ] 4.3 Unit test: JSON response is the raw controller return value (no wrapper)
- [ ] 4.4 Unit test: 406 response when jsonApi disabled
- [ ] 4.5 Unit test: segment requests not intercepted by JSON API (X-Current-Layouts priority)
- [ ] 4.6 Unit test: HTML rendering unchanged when JSON headers absent
- [ ] 4.7 Integration test: full request cycle with Express — JSON request → JSON response

## 5. Documentation

- [ ] 5.1 Add JSON API mode section to docs (configuration, usage, response shape)
