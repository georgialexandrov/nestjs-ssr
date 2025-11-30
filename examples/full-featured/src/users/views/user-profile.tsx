import React, { useState } from 'react';
import type { PageProps } from '@nestjs-ssr/react';

interface User {
  id: number;
  name: string;
  email: string;
  bio?: string;
}

interface UserProfileData {
  user: User;
}

export default function UserProfile({ data, context }: PageProps<UserProfileData>) {
  const { user } = data;
  // Test client-side interactivity
  const [likes, setLikes] = useState(0);

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <a
        href="/users"
        style={{
          color: '#0066cc',
          textDecoration: 'none',
          fontSize: '14px',
        }}
      >
        ← Back to users list
      </a>

      <div
        style={{
          marginTop: '20px',
          padding: '20px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9',
          maxWidth: '600px',
        }}
      >
        <h1 style={{ margin: '0 0 10px 0' }}>{user.name}</h1>
        <p style={{ margin: '0 0 15px 0', color: '#666' }}>
          <strong>Email:</strong> {user.email}
        </p>
        <p style={{ margin: '0 0 15px 0', color: '#666', fontSize: '14px' }}>
          <strong>Route Param ID:</strong> {context.params.id}
        </p>
        {user.bio && (
          <p style={{ margin: '0 0 15px 0', lineHeight: '1.6' }}>{user.bio}</p>
        )}

        <div
          style={{
            marginTop: '20px',
            paddingTop: '20px',
            borderTop: '1px solid #ddd',
          }}
        >
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
            Test Interactivity
          </h3>
          <button
            onClick={() => setLikes(likes + 1)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            👍 Like ({likes})
          </button>
          <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
            Click the button to test that React hydration is working!
          </p>
        </div>
      </div>
    </div>
  );
}
