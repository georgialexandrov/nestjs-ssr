import type { PageProps } from '@nestjs-ssr/react';

interface AboutProps {
  version: string;
  features: string[];
}

export default function About({ version, features }: PageProps<AboutProps>) {
  return (
    <div>
      <h1>About This Demo</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        This demonstrates the segment rendering and client navigation features
        of @nestjs-ssr/react v{version}.
      </p>

      <h2>Features Demonstrated</h2>
      <ul style={{ lineHeight: 1.8 }}>
        {features.map((feature, i) => (
          <li key={i}>{feature}</li>
        ))}
      </ul>

      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#e8f5e9',
          borderRadius: '8px',
          borderLeft: '4px solid #4caf50',
        }}
      >
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#2e7d32' }}>
          How Segment Rendering Works
        </h3>
        <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#555' }}>
          <li>Click a navigation link</li>
          <li>Client sends request with X-Current-Layouts header</li>
          <li>Server determines the swap target layout</li>
          <li>Server renders only the segment (not full page)</li>
          <li>Client swaps content and hydrates the new segment</li>
        </ol>
      </div>
    </div>
  );
}
