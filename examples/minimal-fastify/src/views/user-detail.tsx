import type { PageProps } from '@nestjs-ssr/react';
import { Link, useNavigate } from '@nestjs-ssr/react/client';

interface User {
  id: number;
  name: string;
  email: string;
  bio: string;
  joinedAt: string;
}

interface UserDetailProps {
  user: User;
}

export default function UserDetail({ user }: PageProps<UserDetailProps>) {
  const navigate = useNavigate();

  return (
    <div>
      <Link
        href="/users"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: '#666',
          textDecoration: 'none',
          marginBottom: '1rem',
        }}
      >
        &larr; Back to Users
      </Link>

      <div
        style={{
          padding: '2rem',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
        }}
      >
        <h1 style={{ margin: '0 0 0.5rem 0' }}>{user.name}</h1>
        <p style={{ color: '#666', margin: '0 0 1.5rem 0' }}>{user.email}</p>

        <h3 style={{ marginBottom: '0.5rem' }}>Bio</h3>
        <p style={{ color: '#555', lineHeight: 1.6 }}>{user.bio}</p>

        <p
          style={{
            marginTop: '2rem',
            fontSize: '0.875rem',
            color: '#999',
          }}
        >
          Member since: {user.joinedAt}
        </p>
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        <button
          onClick={() => navigate('/users')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#1a1a2e',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Programmatic Navigate
        </button>
        <p style={{ fontSize: '0.875rem', color: '#666', alignSelf: 'center' }}>
          (Uses useNavigate() hook)
        </p>
      </div>
    </div>
  );
}
