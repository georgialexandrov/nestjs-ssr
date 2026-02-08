import type { PageProps } from '@nestjs-ssr/react';

export interface ItemListProps {
  items: Array<{ id: number; name: string }>;
}

export default function ItemList({ items }: PageProps<ItemListProps>) {
  return (
    <div data-testid="item-list">
      <h1 data-testid="item-list-title">All Items</h1>
      <ul>
        {items.map((item) => (
          <li key={item.id} data-testid={`item-${item.id}`}>
            <a href={`/items/${item.id}`}>{item.name}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
