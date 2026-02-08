import type { LayoutProps } from '@nestjs-ssr/react';

function ItemsLayout({ children }: LayoutProps) {
  return (
    <div data-testid="items-layout" className="items-layout">
      <nav data-testid="items-sidebar">
        <h2>Items</h2>
        <ul>
          <li>
            <a href="/items">All Items</a>
          </li>
          <li>
            <a href="/items/1">Item 1</a>
          </li>
          <li>
            <a href="/items/2">Item 2</a>
          </li>
        </ul>
      </nav>
      <div data-testid="items-content">{children}</div>
    </div>
  );
}

ItemsLayout.displayName = 'ItemsLayout';

export default ItemsLayout;
