/**
 * Unit tests for layout composition logic.
 *
 * These tests verify the critical algorithm that composes layouts in the correct order.
 * The bug we're preventing: layouts being nested in wrong order (inner wrapping outer).
 *
 * Correct: RootLayout > ChildLayout > Page
 * Wrong:   ChildLayout > RootLayout > Page
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

/**
 * Extracted layout composition logic - must match entry-server.tsx and entry-client.tsx
 *
 * The layouts array is ordered [RootLayout, ControllerLayout, MethodLayout] (outer to inner).
 * We iterate in REVERSE order because wrapping happens inside-out:
 * - Start with Page
 * - Wrap with innermost layout first (MethodLayout)
 * - Then wrap with ControllerLayout
 * - Finally wrap with RootLayout (outermost)
 */
function composeWithLayouts(
  ViewComponent: React.ComponentType<any>,
  props: any,
  layouts: Array<{ layout: React.ComponentType<any>; props?: any }> = [],
  context?: any,
): React.ReactElement {
  let result = <ViewComponent {...props} />;

  // CRITICAL: Must iterate in REVERSE order
  for (let i = layouts.length - 1; i >= 0; i--) {
    const { layout: Layout, props: layoutProps } = layouts[i];
    const layoutName = Layout.displayName || Layout.name || 'Layout';
    result = (
      <div data-layout={layoutName}>
        <Layout context={context} layoutProps={layoutProps}>
          <div data-outlet={layoutName}>{result}</div>
        </Layout>
      </div>
    );
  }

  return result;
}

// Test components
function RootLayout({ children }: { children: React.ReactNode }) {
  return <div data-testid="root-layout">{children}</div>;
}
RootLayout.displayName = 'RootLayout';

function ChildLayout({ children }: { children: React.ReactNode }) {
  return <div data-testid="child-layout">{children}</div>;
}
ChildLayout.displayName = 'ChildLayout';

function GrandchildLayout({ children }: { children: React.ReactNode }) {
  return <div data-testid="grandchild-layout">{children}</div>;
}
GrandchildLayout.displayName = 'GrandchildLayout';

function Page({ title }: { title: string }) {
  return <div data-testid="page">{title}</div>;
}
Page.displayName = 'Page';

describe('Layout Composition', () => {
  describe('composeWithLayouts', () => {
    it('should render page without layouts when layouts array is empty', () => {
      const result = composeWithLayouts(Page, { title: 'Test' }, []);
      const html = renderToString(result);

      expect(html).toContain('data-testid="page"');
      expect(html).toContain('Test');
      expect(html).not.toContain('data-layout');
    });

    it('should wrap page with single layout', () => {
      const layouts = [{ layout: RootLayout, props: {} }];
      const result = composeWithLayouts(Page, { title: 'Test' }, layouts);
      const html = renderToString(result);

      // Should have layout wrapper
      expect(html).toContain('data-layout="RootLayout"');
      expect(html).toContain('data-outlet="RootLayout"');
      expect(html).toContain('data-testid="root-layout"');
      expect(html).toContain('data-testid="page"');
    });

    it('should nest layouts in correct order: RootLayout > ChildLayout > Page', () => {
      const layouts = [
        { layout: RootLayout, props: {} },
        { layout: ChildLayout, props: {} },
      ];
      const result = composeWithLayouts(Page, { title: 'Test' }, layouts);
      const html = renderToString(result);

      // Verify both layouts are present
      expect(html).toContain('data-layout="RootLayout"');
      expect(html).toContain('data-layout="ChildLayout"');
      expect(html).toContain('data-testid="page"');

      // CRITICAL: Verify correct nesting order
      // RootLayout should come BEFORE ChildLayout in the HTML (outer wraps inner)
      const rootIndex = html.indexOf('data-layout="RootLayout"');
      const childIndex = html.indexOf('data-layout="ChildLayout"');
      const pageIndex = html.indexOf('data-testid="page"');

      expect(rootIndex).toBeLessThan(childIndex);
      expect(childIndex).toBeLessThan(pageIndex);
    });

    it('should nest three layouts in correct order: Root > Child > Grandchild > Page', () => {
      const layouts = [
        { layout: RootLayout, props: {} },
        { layout: ChildLayout, props: {} },
        { layout: GrandchildLayout, props: {} },
      ];
      const result = composeWithLayouts(Page, { title: 'Test' }, layouts);
      const html = renderToString(result);

      // Verify all layouts present
      expect(html).toContain('data-layout="RootLayout"');
      expect(html).toContain('data-layout="ChildLayout"');
      expect(html).toContain('data-layout="GrandchildLayout"');

      // CRITICAL: Verify correct nesting order
      const rootIndex = html.indexOf('data-layout="RootLayout"');
      const childIndex = html.indexOf('data-layout="ChildLayout"');
      const grandchildIndex = html.indexOf('data-layout="GrandchildLayout"');
      const pageIndex = html.indexOf('data-testid="page"');

      expect(rootIndex).toBeLessThan(childIndex);
      expect(childIndex).toBeLessThan(grandchildIndex);
      expect(grandchildIndex).toBeLessThan(pageIndex);
    });

    it('should pass layoutProps to each layout', () => {
      function LayoutWithProps({
        children,
        layoutProps,
      }: {
        children: React.ReactNode;
        layoutProps?: { title: string };
      }) {
        return (
          <div data-testid="layout-with-props">
            <h1>{layoutProps?.title}</h1>
            {children}
          </div>
        );
      }
      LayoutWithProps.displayName = 'LayoutWithProps';

      const layouts = [
        { layout: LayoutWithProps, props: { title: 'Layout Title' } },
      ];
      const result = composeWithLayouts(Page, { title: 'Page Title' }, layouts);
      const html = renderToString(result);

      expect(html).toContain('Layout Title');
      expect(html).toContain('Page Title');
    });

    it('should pass context to layouts', () => {
      function ContextAwareLayout({
        children,
        context,
      }: {
        children: React.ReactNode;
        context?: { path: string };
      }) {
        return (
          <div data-testid="context-layout">
            <span data-path={context?.path}>Path: {context?.path}</span>
            {children}
          </div>
        );
      }
      ContextAwareLayout.displayName = 'ContextAwareLayout';

      const layouts = [{ layout: ContextAwareLayout, props: {} }];
      const context = { path: '/users/settings' };
      const result = composeWithLayouts(
        Page,
        { title: 'Test' },
        layouts,
        context,
      );
      const html = renderToString(result);

      // React SSR may insert comments in text nodes, so check attribute instead
      expect(html).toContain('data-path="/users/settings"');
      expect(html).toContain('/users/settings');
    });

    it('should create proper data-outlet structure for segment swapping', () => {
      const layouts = [
        { layout: RootLayout, props: {} },
        { layout: ChildLayout, props: {} },
      ];
      const result = composeWithLayouts(Page, { title: 'Test' }, layouts);
      const html = renderToString(result);

      // Each layout should have its own outlet
      expect(html).toContain('data-outlet="RootLayout"');
      expect(html).toContain('data-outlet="ChildLayout"');

      // Outlets should be nested correctly
      const rootOutletIndex = html.indexOf('data-outlet="RootLayout"');
      const childOutletIndex = html.indexOf('data-outlet="ChildLayout"');

      // RootLayout's outlet should contain ChildLayout
      expect(rootOutletIndex).toBeLessThan(childOutletIndex);
    });
  });

  describe('Regression: Forward iteration bug', () => {
    /**
     * This test specifically catches the bug where iterating forward through
     * layouts produces wrong nesting (inner wrapping outer instead of outer wrapping inner).
     */
    it('should NOT produce ChildLayout > RootLayout nesting (the bug)', () => {
      const layouts = [
        { layout: RootLayout, props: {} },
        { layout: ChildLayout, props: {} },
      ];
      const result = composeWithLayouts(Page, { title: 'Test' }, layouts);
      const html = renderToString(result);

      // The bug would produce: ChildLayout > RootLayout > Page
      // Correct order is:       RootLayout > ChildLayout > Page

      const rootIndex = html.indexOf('data-layout="RootLayout"');
      const childIndex = html.indexOf('data-layout="ChildLayout"');

      // If this fails, the bug is back (ChildLayout appearing before RootLayout)
      expect(rootIndex).toBeLessThan(childIndex);
      expect(rootIndex).not.toBe(-1);
      expect(childIndex).not.toBe(-1);
    });
  });
});
