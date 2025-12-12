import type { PageProps } from '@nestjs-ssr/react';
import { useState } from 'react';
import { usePageContext, useTheme } from '../lib/ssr-hooks';

export interface ViewsHomeProps {
  message: string;
  timestamp: string;
}

export default function Home(props: PageProps<ViewsHomeProps>) {
  const { message, timestamp } = props;
  const [count, setCount] = useState(0);

  // Use typed hooks - fully typed with AppRenderContext
  const { path, method, userAgent } = usePageContext();
  const theme = useTheme();

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      <h2 style={{ margin: '0 0 1rem 0', color: '#333' }}>
        Welcome to NestJS SSR with React
      </h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>{message}</p>
      <p style={{ color: '#999', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Server time: {timestamp}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={() => setCount(count - 1)}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: 'pointer',
            border: '2px solid #667eea',
            background: 'white',
            color: '#667eea',
            borderRadius: '6px',
          }}
        >
          -
        </button>
        <span style={{ fontSize: '1.2rem', fontWeight: '600', color: '#333' }}>
          Count: {count}
        </span>
        <button
          onClick={() => setCount(count + 1)}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: 'pointer',
            border: '2px solid #667eea',
            background: '#667eea',
            color: 'white',
            borderRadius: '6px',
          }}
        >
          +
        </button>
      </div>

      <p style={{ marginTop: '2rem', color: '#999', fontSize: '0.85rem' }}>
        This page uses a layout defined in the controller decorator!
      </p>

      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '0.85rem',
        }}
      >
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#333' }}>
          Request Context (from typed hooks):
        </h3>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#666' }}>
          <li>Path: {path}</li>
          <li>Method: {method}</li>
          <li>Theme: {theme}</li>
          <li>User Agent: {userAgent?.substring(0, 50)}...</li>
        </ul>
      </div>
    </div>
  );
}
