import React from 'react';
import { Bell, Power, RefreshCw, Send, Smartphone, Trash2, Users } from 'lucide-react';
import { Badge, Button, Card, FormActions } from '../components/ui';
import { notify } from '../services/feedback';
import {
  deleteNotification,
  listInternalNotifications,
  markNotificationRead,
  syncAutomaticNotifications,
} from '../services/notificationsCenter.service';
import {
  disablePushDevice,
  getNativeNotificationPermission,
  isNativePushSupported,
  isPushSupported,
  listAdminPushDevices,
  listPushDevices,
  registerPushDevice,
  sendTestPush,
} from '../services/push.service';

function notifyNotificationsChanged() {
  window.dispatchEvent(new Event('fintrack:notifications-changed'));
}

export function Notificaciones({ supabase, user, isAdmin = false }) {
  const [devices, setDevices] = React.useState([]);
  const [adminDevices, setAdminDevices] = React.useState([]);
  const [adminSummary, setAdminSummary] = React.useState({ users: 0, registered: 0, not_registered: 0, active_devices: 0 });
  const [internalNotifications, setInternalNotifications] = React.useState([]);
  const [status, setStatus] = React.useState('');
  const [permission, setPermission] = React.useState('verificando');
  const supported = isPushSupported();
  const nativeSupported = isNativePushSupported();

  async function load() {
    await syncAutomaticNotifications(supabase, user.id);
    const [devicesResult, internalResult, permissionResult, adminDevicesResult] = await Promise.all([
      listPushDevices(supabase, user.id),
      listInternalNotifications(supabase, user.id),
      getNativeNotificationPermission(),
      isAdmin ? listAdminPushDevices(supabase) : Promise.resolve({ data: [], error: null }),
    ]);

    setDevices(devicesResult.data || []);
    setInternalNotifications(internalResult.data || []);
    setPermission(permissionResult);

    if (isAdmin) {
      const rows = adminDevicesResult.data || [];
      setAdminDevices(rows);
      setAdminSummary(adminDevicesResult.summary || {
        users: rows.length,
        registered: rows.filter((device) => device.registered).length,
        not_registered: rows.filter((device) => !device.registered).length,
        active_devices: rows.reduce((sum, device) => sum + Number(device.active_devices_count || 0), 0),
      });
      if (adminDevicesResult.error) notify(adminDevicesResult.error.message, 'error');
    }
  }

  React.useEffect(() => {
    load();
  }, [supabase, user.id, isAdmin]);

  async function retryDeviceRegistration() {
    setStatus('Reintentando registro del dispositivo...');
    const { error } = await registerPushDevice(supabase, user.id);
    if (error) {
      setStatus(error.message);
      notify(error.message, 'error');
      return;
    }
    setStatus('Dispositivo registrado correctamente.');
    notify('Dispositivo registrado correctamente.', 'success');
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

  async function refreshAlerts() {
    setStatus('Actualizando alertas internas...');
    const { data, error } = await syncAutomaticNotifications(supabase, user.id, { force: true });
    if (error) {
      setStatus(error.message);
      notify(error.message, 'error');
      return;
    }
    setStatus(`${data.length} alerta(s) nueva(s).`);
    notify('Alertas internas actualizadas.', 'success');
    await load();
  }

  async function toggleRead(item) {
    const { error } = await markNotificationRead(supabase, item.id, !item.leida);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notifyNotificationsChanged();
    await load();
  }

  async function removeInternal(item) {
    const { error } = await deleteNotification(supabase, item.id);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('Alerta eliminada.', 'success');
    notifyNotificationsChanged();
    await load();
  }

  return (
    <div className="notifications-page">
      <Card title="Centro de alertas internas" className="notifications-card">
        <div className="card-body notifications-layout">
          <section className="notification-hero">
            <div className="notification-icon"><Bell size={26} /></div>
            <div>
              <h4>Alertas del sistema</h4>
              <p>Las alertas internas aparecen en la campana. El proceso automatico las mantiene actualizadas sin que tengas que generarlas manualmente.</p>
            </div>
          </section>
          <FormActions>
            <Button variant="primary" onClick={refreshAlerts}><RefreshCw size={16} />Actualizar alertas</Button>
            <Button onClick={load}>Actualizar</Button>
          </FormActions>
          <div className="notification-internal-list">
            {internalNotifications.length ? internalNotifications.map((item) => (
              <div className={`notification-internal-item ${item.leida ? 'read' : ''}`} key={item.id}>
                <div>
                  <Badge tone={item.tipo === 'danger' ? 'red' : item.tipo === 'warning' ? 'yellow' : 'gray'}>{item.tipo}</Badge>
                  <strong>{item.titulo}</strong>
                  <p>{item.mensaje}</p>
                  <span>{new Date(item.created_at).toLocaleString('es-PE')}</span>
                </div>
                <div className="row-actions">
                  <Button size="sm" onClick={() => toggleRead(item)}>{item.leida ? 'No leida' : 'Leida'}</Button>
                  <Button size="sm" iconOnly variant="danger" onClick={() => removeInternal(item)}><Trash2 size={14} /></Button>
                </div>
              </div>
            )) : <p className="muted">Sin alertas internas registradas.</p>}
          </div>
          {status && <div className={`connection-status ${status.includes('correctamente') || status.includes('nueva') ? 'success' : ''}`}>{status}</div>}
        </div>
      </Card>

      {isAdmin && (
        <Card title="Dispositivos de app movil" className="notifications-card">
          <div className="card-body notifications-layout">
            <section className="notification-hero">
              <div className="notification-icon"><Smartphone size={26} /></div>
              <div>
                <h4>Control administrativo de notificaciones moviles</h4>
                <p>Los usuarios no ven esta configuracion. La app Android registra el dispositivo automaticamente cuando el usuario inicia sesion y acepta el permiso del sistema.</p>
              </div>
            </section>

            <section className="notification-status-grid">
              <div>
                <span>Usuarios</span>
                <strong>{adminSummary.users}</strong>
              </div>
              <div>
                <span>Registrados</span>
                <strong>{adminSummary.registered}</strong>
              </div>
              <div>
                <span>Sin registrar</span>
                <strong>{adminSummary.not_registered}</strong>
              </div>
              <div>
                <span>Dispositivos activos</span>
                <strong>{adminSummary.active_devices}</strong>
              </div>
            </section>

            {!nativeSupported ? (
              <div className="connection-status">
                Estas viendo la version web. Las notificaciones reales del celular se registran desde la app Android.
              </div>
            ) : (
              <div className="connection-status success">
                Permiso de este dispositivo: {permission}. Dispositivos activos de tu usuario: {devices.filter((device) => device.enabled).length}.
              </div>
            )}

            <section className="notification-actions">
              <Button onClick={retryDeviceRegistration} disabled={!supported}><RefreshCw size={16} />Reintentar mi registro</Button>
              <Button onClick={deactivate} disabled={!supported || !devices.some((device) => device.enabled)}><Power size={16} />Desactivar este dispositivo</Button>
              <Button variant="primary" onClick={testPush} disabled={!devices.some((device) => device.enabled)}><Send size={16} />Enviar prueba a mi dispositivo</Button>
            </section>

            <section className="notification-devices">
              <h4>Usuarios y estado de registro</h4>
              {adminDevices.length ? adminDevices.map((device) => (
                <div className={`notification-device admin-device ${device.registered ? 'registered' : 'pending'}`} key={device.user_id}>
                  {device.registered ? <Smartphone size={18} /> : <Users size={18} />}
                  <div>
                    <strong>{[device.nombre, device.apellido].filter(Boolean).join(' ') || device.email || 'Usuario'}</strong>
                    <span>{device.email || 'Sin correo'} · {device.registered ? `${device.device_name || 'Dispositivo'} activo` : 'Sin app movil registrada'}</span>
                    {device.last_used_at && <small>Ultimo uso: {new Date(device.last_used_at).toLocaleString('es-PE')}</small>}
                  </div>
                  <Badge tone={device.registered ? 'green' : 'yellow'}>{device.registered ? 'Registrado' : 'Pendiente'}</Badge>
                </div>
              )) : <p className="muted">Aun no hay usuarios para revisar.</p>}
            </section>

            <FormActions>
              <Button onClick={load}>Actualizar estado</Button>
            </FormActions>
          </div>
        </Card>
      )}
    </div>
  );
}
