/**
 * Type representing the JSON API response shape.
 *
 * When JSON API mode is enabled and a request includes `Accept: application/json`,
 * the response body is the raw controller return value — this type.
 *
 * @typeParam T - The controller return type (same shape as the React component's data props)
 *
 * @example
 * ```typescript
 * // Controller returns { recipes: Recipe[], total: number }
 * // JSON API response is typed as:
 * type Response = JsonApiResponse<{ recipes: Recipe[]; total: number }>;
 * // → { recipes: Recipe[]; total: number }
 * ```
 */
export type JsonApiResponse<T> = T;
