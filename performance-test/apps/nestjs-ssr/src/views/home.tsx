import type { PageProps } from '@nestjs-ssr/react';
import { useState } from 'react';

interface HomeProps {
  message: string;
  items: Array<{ id: number; name: string; description: string }>;
}

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div
      style={{
        margin: '2rem 0',
        padding: '1rem',
        background: '#f5f5f5',
        borderRadius: '4px',
      }}
    >
      <h2>Counter: {count}</h2>
      <div>
        <button
          onClick={() => setCount(count + 1)}
          style={{
            background: '#e0234e',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            margin: '0 0.5rem',
          }}
        >
          Increment
        </button>
        <button
          onClick={() => setCount(count - 1)}
          style={{
            background: '#e0234e',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            margin: '0 0.5rem',
          }}
        >
          Decrement
        </button>
      </div>
    </div>
  );
}

export default function Home({ data }: PageProps<HomeProps>) {
  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '2rem',
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ color: '#e0234e' }}>Performance Test - NestJS SSR</h1>
      <p>{data.message}</p>

      <Counter />

      <h2>Items</h2>
      {data.items.map((item) => (
        <div
          key={item.id}
          style={{
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '1rem',
            margin: '1rem 0',
          }}
        >
          <h3 style={{ marginTop: 0, color: '#333' }}>{item.name}</h3>
          <p>{item.description}</p>
        </div>
      ))}
    </div>
  );
}
