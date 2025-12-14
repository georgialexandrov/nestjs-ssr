import type { PageProps } from '@nestjs-ssr/react';
import { Link } from '@nestjs-ssr/react/client';

interface User {
  id: number;
  name: string;
  email: string;
}

interface UsersProps {
  users: User[];
}

export default function Users({ users }: PageProps<UsersProps>) {
  return (
    <div>
      <h1>Users</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Click a user to see segment navigation to a detail page.
      </p>

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        }}
      >
        {users.map((user) => (
          <Link
            key={user.id}
            href={`/users/${user.id}`}
            style={{
              display: 'block',
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0' }}>{user.name}</h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              {user.email}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
