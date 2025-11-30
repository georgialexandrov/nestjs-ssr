import React from 'react';
import { renderToString, renderToPipeableStream } from 'react-dom/server';
import type { Writable } from 'stream';
import App from './app';
import { viewRegistry } from './view-registry.generated';

/**
 * Render component to string (traditional SSR)
 *
 * Blocks until entire React tree is rendered, then returns complete HTML string.
 * Simple, proven approach good for debugging and small pages.
 */
export async function renderComponent(
  componentPath: string,
  props: any = {},
): Promise<string> {
  try {
    const Component = viewRegistry[componentPath];

    if (!Component) {
      throw new Error(
        `Component not found at path: ${componentPath}. Available paths: ${Object.keys(viewRegistry).join(', ')}`,
      );
    }

    // Extract data and context from props
    const { data, __context: context } = props;

    // Render the component wrapped in App with context
    const html = renderToString(
      <App context={context}>
        <Component data={data} context={context} />
      </App>,
    );

    return html;
  } catch (error) {
    console.error(`Failed to render component at ${componentPath}:`, error);
    throw error;
  }
}

/**
 * Streaming render callbacks
 */
export interface StreamCallbacks {
  onShellReady?: () => void;
  onShellError?: (error: Error) => void;
  onError?: (error: Error) => void;
  onAllReady?: () => void;
}

/**
 * Render component to pipeable stream (streaming SSR)
 *
 * Returns immediately with stream controller. Sends shell HTML first,
 * then streams remaining content progressively.
 * Better performance, enables Suspense, more complex error handling.
 */
export function renderComponentStream(
  componentPath: string,
  props: any = {},
  callbacks: StreamCallbacks = {},
): { pipe: (destination: Writable) => void; abort: () => void } {
  const Component = viewRegistry[componentPath];

  if (!Component) {
    // Throw synchronously - will be caught by caller
    throw new Error(
      `Component not found at path: ${componentPath}. Available paths: ${Object.keys(viewRegistry).join(', ')}`,
    );
  }

  // Extract data and context from props
  const { data, __context: context } = props;

  // Track if error occurred
  let didError = false;

  // Create pipeable stream
  const stream = renderToPipeableStream(
    <App context={context}>
      <Component data={data} context={context} />
    </App>,
    {
      onShellReady() {
        // Shell (initial HTML structure) is ready
        // Can start streaming now
        callbacks.onShellReady?.();
      },

      onShellError(error: Error) {
        // Error occurred before shell completed
        // Headers not sent yet, can still send error response
        didError = true;
        callbacks.onShellError?.(error);
      },

      onError(error: Error) {
        // Error occurred during streaming
        // Headers already sent, can only log
        didError = true;
        callbacks.onError?.(error);
      },

      onAllReady() {
        // All content (including Suspense) is ready
        // Not typically used for streaming
        callbacks.onAllReady?.();
      },
    },
  );

  return stream;
}
