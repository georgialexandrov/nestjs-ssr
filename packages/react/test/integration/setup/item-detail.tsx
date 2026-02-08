import { useState } from 'react';
import type { PageProps } from '@nestjs-ssr/react';

export interface ItemDetailProps {
  item: { id: number; name: string; description: string };
}

export default function ItemDetail({ item }: PageProps<ItemDetailProps>) {
  const [liked, setLiked] = useState(false);

  return (
    <div data-testid="item-detail">
      <h1 data-testid="item-name">{item.name}</h1>
      <p data-testid="item-description">{item.description}</p>
      <button data-testid="like-button" onClick={() => setLiked(!liked)}>
        {liked ? 'Unlike' : 'Like'}
      </button>
      <span data-testid="like-status">{liked ? 'Liked' : 'Not liked'}</span>
    </div>
  );
}
