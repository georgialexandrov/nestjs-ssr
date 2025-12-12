import type { PageProps } from '@nestjs-ssr/react';
import { useFeatureFlag } from '../lib/ssr-hooks';

export interface DashboardProps {
  stats: {
    users: number;
    revenue: number;
    orders: number;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
  featureFlags?: Record<string, boolean>;
}

export default function Dashboard(props: PageProps<DashboardProps>) {
  const { stats, user, featureFlags } = props;

  // Use custom helper hooks for clean code
  const hasAnalytics = useFeatureFlag('analytics');

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
      }}
    >
      <h3 style={{ margin: '0 0 1.5rem 0', color: '#333' }}>Overview</h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
        }}
      >
        <div
          style={{
            padding: '1rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '8px',
            color: 'white',
          }}
        >
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Total Users</div>
          <div
            style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              marginTop: '0.5rem',
            }}
          >
            {stats.users}
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            borderRadius: '8px',
            color: 'white',
          }}
        >
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Revenue</div>
          <div
            style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              marginTop: '0.5rem',
            }}
          >
            ${stats.revenue}
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            borderRadius: '8px',
            color: 'white',
          }}
        >
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Orders</div>
          <div
            style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              marginTop: '0.5rem',
            }}
          >
            {stats.orders}
          </div>
        </div>
      </div>

      <p style={{ marginTop: '2rem', color: '#999', fontSize: '0.85rem' }}>
        This page demonstrates nested layouts using the @Layout decorator!
      </p>

      {user && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#f8f9fa',
            borderRadius: '8px',
            fontSize: '0.85rem',
          }}
        >
          <h4
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.95rem',
              color: '#333',
            }}
          >
            User Info (from props):
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#666' }}>
            <li>ID: {user.id}</li>
            <li>Name: {user.name}</li>
            <li>Email: {user.email}</li>
          </ul>
        </div>
      )}

      {featureFlags && Object.keys(featureFlags).length > 0 && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#f0f9ff',
            borderRadius: '8px',
            fontSize: '0.85rem',
          }}
        >
          <h4
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.95rem',
              color: '#333',
            }}
          >
            Feature Flags (from typed hooks):
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#666' }}>
            {Object.entries(featureFlags).map(([flag, enabled]) => (
              <li key={flag}>
                {flag}: {enabled ? '✓ Enabled' : '✗ Disabled'}
              </li>
            ))}
          </ul>
          <p
            style={{
              marginTop: '0.5rem',
              marginBottom: 0,
              fontStyle: 'italic',
              color: '#999',
            }}
          >
            Using useFeatureFlag('analytics'): {hasAnalytics ? '✓' : '✗'}
          </p>
        </div>
      )}
    </div>
  );
}
