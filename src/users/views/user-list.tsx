import React from 'react';
import type { PageProps } from '../../shared/render/interfaces/index';

interface User {
  id: number;
  name: string;
  email: string;
}

interface UserListData {
  users: User[];
}

export default function UserList({ data, context }: PageProps<UserListData>) {
  const { users } = data;

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Users</h1>
      <p>Welcome to the NestJS + React SSR prototype!</p>
      <p style={{ fontSize: '14px', color: '#666' }}>
        Viewing from: {context.path}
      </p>
      <div
        style={{
          display: 'grid',
          gap: '15px',
          maxWidth: '600px',
          marginTop: '20px',
        }}
      >
        {users.map((user) => (
          <div
            key={user.id}
            style={{
              padding: '15px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: '#f9f9f9',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0' }}>
              <a
                href={`/users/${user.id}`}
                style={{ color: '#0066cc', textDecoration: 'none' }}
              >
                {user.name}
              </a>
            </h3>
            <p style={{ margin: 0, color: '#666' }}>{user.email}</p>
          </div>
        ))}
      </div>
      <p style={{ marginTop: '30px', color: '#666', fontSize: '14px' }}>
        This page was server-side rendered with React and is now hydrated for
        interactivity!
      </p>
    </div>
  );
}
