import React, { useState } from 'react';

interface CounterProps {
  initialCount?: number;
}

export default function Counter({ initialCount = 0 }: CounterProps) {
  const [count, setCount] = useState(initialCount);

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: '#f0f7ff',
        borderRadius: '8px',
        border: '2px solid #0066cc',
        textAlign: 'center',
      }}
    >
      <h3 style={{ marginTop: 0, color: '#0066cc' }}>
        Interactive Counter Demo
      </h3>
      <div
        style={{
          fontSize: '48px',
          fontWeight: 'bold',
          margin: '20px 0',
          color: '#333',
        }}
      >
        {count}
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
          onClick={() => setCount(count - 1)}
          style={{
            padding: '10px 20px',
            fontSize: '18px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          -
        </button>
        <button
          onClick={() => setCount(initialCount)}
          style={{
            padding: '10px 20px',
            fontSize: '18px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
        <button
          onClick={() => setCount(count + 1)}
          style={{
            padding: '10px 20px',
            fontSize: '18px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>
      <p style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
        This counter proves client-side hydration is working! <br />
        The buttons only work after React has hydrated the page.
      </p>
    </div>
  );
}
