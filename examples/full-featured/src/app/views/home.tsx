import React from 'react';
import Counter from '../../shared/views/counter';
import type { PageProps } from '@nestjs-ssr/react';

interface HomeData {
  message: string;
}

export default function Home({ data, context }: PageProps<HomeData>) {
  const { message } = data;

  return (
    <div
      style={{
        padding: '40px',
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>{message}</h1>

      <div
        style={{
          padding: '30px',
          backgroundColor: '#f0f7ff',
          borderRadius: '8px',
          border: '2px solid #0066cc',
          marginBottom: '30px',
        }}
      >
        <h2 style={{ marginTop: 0, color: '#0066cc' }}>
          🎉 NestJS + React SSR Prototype
        </h2>
        <p style={{ lineHeight: '1.6', fontSize: '16px' }}>
          This is a working prototype that integrates React as a view layer for
          NestJS with server-side rendering and client-side hydration!
        </p>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <Counter initialCount={0} />
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h3>Features2:</h3>
        <ul style={{ lineHeight: '1.8', fontSize: '16px' }}>
          <li>✅ React SSR with NestJS</li>
          <li>✅ Client-side hydration</li>
          <li>✅ Vite integration for fast development</li>
          <li>✅ Module-based architecture (domain-driven design)</li>
          <li>✅ TypeScript support with path aliases</li>
          <li>✅ Custom @Render decorator</li>
          <li>✅ Hot Module Replacement (HMR)</li>
          <li>✅ Shared components across modules</li>
          <li>✅ Type-safe PageProps with request context</li>
        </ul>
      </div>

      <div
        style={{
          marginBottom: '30px',
          padding: '20px',
          backgroundColor: '#e7f3ff',
          borderRadius: '8px',
          border: '1px solid #0066cc',
        }}
      >
        <h3 style={{ marginTop: 0, color: '#0066cc' }}>Request Context Demo</h3>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
          This page has access to request metadata:
        </p>
        <ul style={{ fontSize: '14px', fontFamily: 'monospace' }}>
          <li>
            <strong>Path:</strong> {context.path}
          </li>
          <li>
            <strong>URL:</strong> {context.url}
          </li>
          {context.userAgent && (
            <li>
              <strong>User Agent:</strong> {context.userAgent}
            </li>
          )}
          {context.acceptLanguage && (
            <li>
              <strong>Language:</strong> {context.acceptLanguage}
            </li>
          )}
        </ul>
      </div>

      <div
        style={{
          padding: '20px',
          backgroundColor: '#fff3cd',
          borderRadius: '8px',
          border: '1px solid #ffc107',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Try it out:</h3>
        <p style={{ marginBottom: '15px' }}>
          Visit the{' '}
          <a
            href="/users"
            style={{
              color: '#0066cc',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
          >
            Users page
          </a>{' '}
          to see server-side rendering and client-side interactivity in action!
        </p>
      </div>

      <div
        style={{
          marginTop: '40px',
          padding: '20px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Architecture Highlights:</h3>
        <ul style={{ lineHeight: '1.8', fontSize: '14px', color: '#666' }}>
          <li>
            <strong>Module-based:</strong> Each NestJS module has its own{' '}
            <code>views/</code> directory
          </li>
          <li>
            <strong>Clean Architecture:</strong> Domain-driven design with views
            as part of modules
          </li>
          <li>
            <strong>Single command:</strong> <code>pnpm start:dev</code> handles
            everything
          </li>
          <li>
            <strong>Developer happiness:</strong> Fast HMR, TypeScript,
            organized structure
          </li>
        </ul>
      </div>
    </div>
  );
}
