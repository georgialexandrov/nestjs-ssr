import type { LayoutProps } from '@nestjs-ssr/react';

interface DashboardLayoutProps {
  activeTab?: string;
  lastUpdated?: string;
}

export default function DashboardLayout({
  children,
  layoutProps,
}: LayoutProps<DashboardLayoutProps>) {
  const activeTab = layoutProps?.activeTab || 'overview';
  const lastUpdated = layoutProps?.lastUpdated;

  return (
    <div style={{ padding: '2rem' }}>
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2 style={{ margin: 0, color: '#333' }}>Dashboard</h2>
          {lastUpdated && (
            <span style={{ fontSize: '0.875rem', color: '#666' }}>
              Last updated: {lastUpdated}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {['overview', 'analytics', 'settings'].map((tab) => (
            <button
              key={tab}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '6px',
                background: activeTab === tab ? '#667eea' : '#e0e0e0',
                color: activeTab === tab ? 'white' : '#666',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
