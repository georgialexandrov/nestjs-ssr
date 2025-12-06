import { useState } from "react";
import type { Route } from "./+types/_index";

interface Item {
  id: number;
  name: string;
  description: string;
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
            background: '#3992ff',
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
            background: '#3992ff',
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

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Performance Test - React Router 7" },
    { name: "description", content: "Performance testing with React Router 7" },
  ];
}

export function loader() {
  return {
    message: 'Welcome to React Router 7 (Remix)',
    items: Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      description: `This is item number ${i + 1}`,
    })),
  };
}

export default function Index({ loaderData }: Route.ComponentProps) {
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
      <h1 style={{ color: '#3992ff' }}>Performance Test - React Router 7</h1>
      <p>{loaderData.message}</p>

      <Counter />

      <h2>Items</h2>
      {loaderData.items.map((item: Item) => (
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
