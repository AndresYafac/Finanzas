import React from 'react';
import { Bell, Check, Power, Send, Smartphone } from 'lucide-react';
import { Button, Card, FormActions, SelectField } from '../components/ui';
import { notify } from '../services/feedback';
import {
  disablePushDevice,
  getNotificationPermission,
  getPushPreferences,
  getVapidPublicKey,
  isPushSupported,
  listPushDevices,
  registerPushDevice,
  savePushPreferences,
  sendTestPush,
} from '../services/push.service';

const ALERT_OPTIONS = [
  ['debts_enabled', 'Cuentas por cobrar vencidas o por vencer'],
  ['budgets_enabled', 'Presupuestos en alerta'],
  ['goals_enabled', 'Metas vencidas o por revisar'],
  ['low_balance_enabled', 'Saldos bajos'],
  ['loans_enabled', 'Prestamos por pagar'],
];

export function Notificaciones({ supabase, user }) {
  const [preferences, setPreferences] = React.useState(null);
  const [devices, setDevices] = React.useState([]);
  const [status, setStatus] = React.useState('');
  const supported = isPushSupported();
  const permission = getNotificationPermission();
  const hasVapidKey = !!getVapidPublicKey();

  async function load() {
    const [preferencesResult, devicesResult] = await Promise.all([
      getPushPreferences(supabase, user.id),
      listPushDevices(supabase, user.id),
    ]);
    setPreferences(preferencesResult.data);
    setDevices(devicesResult.data || []);
  }

  React.useEffect(() => {
    load();
  }, [supabase, user.id]);

  async function activate() {
    setStatus('Solicitando permiso del dispositivo...');
    const { error } = await registerPushDevice(supabase, user.id);
    if (error) {
      setStatus(error.message);
      notify(error.message, 'error');
      return;
    }
    setStatus('Notificaciones activadas en este dispositivo.');
    notify('Notificaciones activadas.', 'success');
    await load();
  }

  async function deactivate() {
    setStatus('Desactivando notificaciones...');
    const { error } = await disablePushDevice(supabase, user.id);
    if (error) {
      setStatus(error.message);
      notify(error.message, 'error');
      return;
    }
    setStatus('Notificaciones desactivadas en este dispositivo.');
    notify('Notificaciones desactivadas.', 'success');
    await load();
  }

  async function updatePreference(key, value) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    const { error } = await savePushPreferences(supabase, user.id, next);
    if (error) notify(error.message, 'error');
  }

  async function testPush() {
    setStatus('Enviando notificacion de prueba...');
    const { data, error } = await sendTestPush(supabase);
    if (error) {
      setStatus(error.message);
      notify(error.message, 'error');
      return;
    }
    setStatus(`Prueba enviada a ${data?.sent || 0} dispositivo(s).`);
    notify('Notificacion de prueba enviada.', 'success');
  }

  return (
    <div className="notifications-page">
      <Card title="Notificaciones push" className="notifications-card">
        <div className="card-body notifications-layout">
          <section className="notification-hero">
            <div className="notification-icon"><Bell size={26} /></div>
            <div>
              <h4>Alertas en tu celular</h4>
              <p>Activa avisos reales del navegador para recibir alertas incluso cuando la app este cerrada.</p>
            </div>
          </section>

          <section className="notification-status-grid">
            <div>
              <span>Soporte</span>
              <strong>{supported ? 'Compatible' : 'No compatible'}</strong>
            </div>
            <div>
              <span>Permiso</span>
              <strong>{permission}</strong>
            </div>
            <div>
              <span>Clave VAPID</span>
              <strong>{hasVapidKey ? 'Configurada' : 'Pendiente'}</strong>
            </div>
            <div>
              <span>Dispositivos activos</span>
              <strong>{devices.filter((device) => device.enabled).length}</strong>
            </div>
          </section>

          {!hasVapidKey && (
            <div className="connection-status">
              Falta configurar VITE_VAPID_PUBLIC_KEY en Vercel y las claves VAPID privadas en Supabase.
            </div>
          )}

          <section className="notification-actions">
            <Button variant="primary" onClick={activate} disabled={!supported || !hasVapidKey}><Check size={16} />Activar en este dispositivo</Button>
            <Button onClick={deactivate} disabled={!supported}><Power size={16} />Desactivar este dispositivo</Button>
            <Button onClick={testPush} disabled={!preferences?.enabled}><Send size={16} />Enviar prueba</Button>
          </section>

          {preferences && (
            <section className="notification-preferences">
              <h4>Tipos de alerta</h4>
              <div className="notification-toggle-list">
                {ALERT_OPTIONS.map(([key, label]) => (
                  <label key={key} className="notification-toggle">
                    <span>{label}</span>
                    <input type="checkbox" checked={!!preferences[key]} onChange={(event) => updatePreference(key, event.target.checked)} />
                  </label>
                ))}
              </div>
              <p className="muted">La hora se usara cuando activemos el proceso automatico programado de alertas. Por ahora queda guardada como preferencia.</p>
              <SelectField label="Hora para futuros recordatorios automaticos" value={String(preferences.reminder_hour)} onChange={(value) => updatePreference('reminder_hour', Number(value))}>
                {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}
              </SelectField>
            </section>
          )}

          <section className="notification-devices">
            <h4>Dispositivos registrados</h4>
            {devices.length ? devices.map((device) => (
              <div className="notification-device" key={device.id}>
                <Smartphone size={18} />
                <div>
                  <strong>{device.device_name || 'Dispositivo'}</strong>
                  <span>{device.enabled ? 'Activo' : 'Desactivado'} · {device.updated_at ? new Date(device.updated_at).toLocaleString('es-PE') : ''}</span>
                </div>
              </div>
            )) : <p className="muted">Aun no hay dispositivos registrados.</p>}
          </section>

          {status && <div className={`connection-status ${status.includes('activadas') || status.includes('enviada') ? 'success' : ''}`}>{status}</div>}

          <FormActions>
            <Button onClick={load}>Actualizar estado</Button>
          </FormActions>
        </div>
      </Card>
    </div>
  );
}
