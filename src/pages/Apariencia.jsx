import React from 'react';
import { AppearanceSettings } from '../components/AppearanceSettings';
import { Card } from '../components/ui';

export function Apariencia({ user }) {
  const [status, setStatus] = React.useState('');

  return (
    <div className="appearance-page">
      <Card title="Apariencia del sistema" className="appearance-module-card">
        <AppearanceSettings userId={user.id} onStatus={setStatus} />
        {status && <div className="connection-status success appearance-status">{status}</div>}
      </Card>
    </div>
  );
}
