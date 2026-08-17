import type { ComponentType } from 'react';
import type { RenderContext } from './render-context.interface';

/**
 * Data a controller returns for a page.
 *
 * The framework never inspects these values — it serializes them into the
 * hydration payload and spreads them as props. `unknown` rather than `any`
 * keeps that opacity honest: internal code can pass the object around but
 * cannot silently dereference fields it has not checked.
 */
export type PageData = Record<string, unknown>;

/**
 * Extra props a layout receives via `@Layout(Component, { props })` or a
 * page's static `layoutProps`. Same reasoning as {@link PageData}.
 */
export type LayoutPropsData = Record<string, unknown>;

/**
 * A React component the framework renders without knowing its prop shape.
 *
 * `any` is deliberate and confined to this alias. Page and layout components
 * are written by the user with concrete prop types, and a component is only
 * assignable to `ComponentType<P>` when it accepts exactly `P`. Naming the
 * escape hatch once keeps every other signature in the codebase precise.
 */
export type AnyComponent = ComponentType<any>;

/**
 * A view module as produced by Vite's `import.meta.glob` — the default export
 * is the page or layout component.
 */
export interface ViewModule {
  default: AnyComponent;
}

/**
 * The minimum needed to derive a stable display name from a component.
 * Accepts plain functions, `React.memo` results, and anything else carrying
 * a `displayName` or `name`.
 */
export interface NamedComponent {
  displayName?: string;
  name?: string;
}

/**
 * A layout resolved server-side, paired with the props it should receive.
 * Holds the component itself, so it never crosses to the client.
 */
export interface ResolvedLayout {
  layout: AnyComponent;
  props?: LayoutPropsData;
}

/**
 * Layout metadata serialized for the client: names and props only, never
 * functions. Produced by `serializeLayoutMetadata` and consumed during
 * segment hydration.
 */
export interface SerializedLayout {
  name: string;
  props?: LayoutPropsData;
}

/**
 * The payload handed to the entry-server render functions.
 *
 * The controller's own data lives under `data`; the framework's context and
 * layout chain sit beside it under underscore-prefixed keys so they cannot
 * collide with a page's props.
 */
export interface RenderPayload {
  data: PageData;
  __context: RenderContext;
  __layouts?: ResolvedLayout[];
}
