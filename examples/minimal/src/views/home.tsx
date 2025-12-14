import type { PageProps } from '@nestjs-ssr/react';
import { useState } from 'react';

interface HomeProps {
  message: string;
  timestamp: string;
}

export default function Home({ message, timestamp }: PageProps<HomeProps>) {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>Home Page</h1>
      <p style={{ color: '#666' }}>{message}</p>
      <p style={{ fontSize: '0.875rem', color: '#999' }}>
        Server rendered at: {timestamp}
      </p>

      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
        }}
      >
        <h3 style={{ margin: '0 0 1rem 0' }}>Interactive Counter</h3>
        <p
          style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}
        >
          This counter proves hydration is working - try incrementing then
          navigating away and back.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => setCount(count - 1)} style={buttonStyle}>
            -
          </button>
          <span
            style={{
              fontSize: '1.5rem',
              minWidth: '3rem',
              textAlign: 'center',
            }}
          >
            {count}
          </span>
          <button onClick={() => setCount(count + 1)} style={buttonStyle}>
            +
          </button>
        </div>
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  fontSize: '1.25rem',
  cursor: 'pointer',
  border: '1px solid #ccc',
  borderRadius: '4px',
  backgroundColor: 'white',
};
