import type { PageProps } from '@nestjs-ssr/react';

interface SettingsProps {
  settings: {
    emailNotifications: boolean;
    darkMode: boolean;
    language: string;
  };
}

export default function UsersSettings({ settings }: PageProps<SettingsProps>) {
  return (
    <div>
      <h2>User Settings</h2>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        This page tests nested layouts - it should have both the top nav and the
        users submenu.
      </p>

      <div style={{ maxWidth: '400px' }}>
        <div style={settingRowStyle}>
          <span>Email Notifications</span>
          <span>{settings.emailNotifications ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div style={settingRowStyle}>
          <span>Dark Mode</span>
          <span>{settings.darkMode ? 'On' : 'Off'}</span>
        </div>
        <div style={settingRowStyle}>
          <span>Language</span>
          <span>{settings.language}</span>
        </div>
      </div>
    </div>
  );
}

const settingRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.75rem 0',
  borderBottom: '1px solid #eee',
};
