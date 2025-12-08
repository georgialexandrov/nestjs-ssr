import type { PageProps } from '@nestjs-ssr/react';

export interface DashboardProps {
  stats: {
    users: number;
    revenue: number;
    orders: number;
  };
}

export default function Dashboard(props: PageProps<DashboardProps>) {
  const { stats } = props;

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <div
          style={{
            padding: '1rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '8px',
            color: 'white',
          }}
        >
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Total Users</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
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
          <div style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
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
          <div style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
            {stats.orders}
          </div>
        </div>
      </div>

      <p style={{ marginTop: '2rem', color: '#999', fontSize: '0.85rem' }}>
        This page demonstrates nested layouts using the @Layout decorator!
      </p>
    </div>
  );
}
