import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const MANAGED_MODULES = ['deudas', 'prestamos-recibidos', 'cuentas', 'presupuestos', 'metas', 'movimientos'];
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function getCorsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '';
  const allowOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin)
    ? (allowedOrigins.includes('*') ? '*' : origin)
    : allowedOrigins[0] || '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-auto-alerts-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function jsonResponse(request: Request, status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...getCorsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function month() {
  return today().slice(0, 7);
}

function daysBetween(dateValue: string | null | undefined) {
  if (!dateValue) return null;
  const start = new Date(`${today()}T00:00:00Z`);
  const end = new Date(`${dateValue}T00:00:00Z`);
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

function daysSince(dateValue: string | null | undefined) {
  if (!dateValue) return null;
  const start = new Date(`${dateValue}T00:00:00Z`);
  const end = new Date(`${today()}T00:00:00Z`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function notificationKey(notification: { modulo?: string; referencia_id?: string; titulo?: string }) {
  return `${notification.modulo || ''}|${notification.referencia_id || ''}|${notification.titulo || ''}`;
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isLinkedWallet(account: { tipo_entidad?: string; cuenta_vinculada_id?: string | null }) {
  return account.tipo_entidad === 'billetera' && Boolean(account.cuenta_vinculada_id);
}

function movementLabel(movement: { categoria?: string | null; tipo_movimiento_id?: string | null; tipo?: string | null }) {
  return movement.categoria || movement.tipo_movimiento_id || movement.tipo || 'Movimiento';
}

function base64UrlEncode(value: string | ArrayBuffer) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function getFirebaseAccessToken(credentials: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64UrlEncode(JSON.stringify({
    iss: credentials.client_email,
    scope: FCM_SCOPE,
    aud: OAUTH_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const unsignedJwt = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(credentials.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsignedJwt));
  const jwt = `${unsignedJwt}.${base64UrlEncode(signature)}`;
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || 'No se pudo autenticar con Firebase.');
  return data.access_token as string;
}

function getFirebaseCredentials() {
  const encoded = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_BASE64') || '';
  const raw = encoded
    ? new TextDecoder().decode(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)))
    : (Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || '');
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
    if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
      throw new Error('El JSON de Firebase no contiene project_id, client_email o private_key.');
    }
    return credentials as { project_id: string; client_email: string; private_key: string };
  } catch (error) {
    throw new Error(`Credenciales Firebase invalidas. Configura FIREBASE_SERVICE_ACCOUNT_BASE64 nuevamente. ${error instanceof Error ? error.message : ''}`);
  }
}

async function sendFcmSummary(adminClient: ReturnType<typeof createClient>, userId: string, count: number) {
  const credentials = getFirebaseCredentials();
  if (!credentials || count <= 0) return { sent: 0, skipped: 'firebase_not_configured' };

  const { data: devices, error } = await adminClient
    .from('mobile_push_devices')
    .select('id,token')
    .eq('user_id', userId)
    .eq('enabled', true);

  if (error) throw error;
  if (!devices?.length) return { sent: 0 };

  const accessToken = await getFirebaseAccessToken(credentials);
  const notificationBody = count === 1 ? 'Tienes 1 alerta financiera pendiente.' : `Tienes ${count} alertas financieras pendientes.`;
  let sent = 0;

  for (const device of devices) {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${credentials.project_id}/messages:send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: device.token,
          notification: {
            title: 'FinTrack Pro',
            body: notificationBody,
          },
          data: {
            url: '/?page=notificaciones',
            tag: `fintrack-alerts-${today()}`,
            type: 'alert',
          },
          android: {
            priority: 'HIGH',
            notification: {
              channel_id: 'fintrack_alerts',
              sound: 'default',
            },
          },
        },
      }),
    });

    if (response.ok) {
      sent += 1;
      await adminClient.from('mobile_push_devices').update({ last_used_at: new Date().toISOString() }).eq('id', device.id);
      continue;
    }

    const data = await response.json().catch(() => ({}));
    const errorCode = data?.error?.details?.[0]?.errorCode || data?.error?.status || '';
    if (['UNREGISTERED', 'INVALID_ARGUMENT', 'NOT_FOUND'].includes(errorCode)) {
      await adminClient.from('mobile_push_devices').update({ enabled: false }).eq('id', device.id);
    }
  }

  return { sent };
}

async function sendPushSummary(adminClient: ReturnType<typeof createClient>, userId: string, count: number) {
  const fcm = await sendFcmSummary(adminClient, userId, count);
  if (fcm.sent || fcm.skipped !== 'firebase_not_configured') return { channel: 'fcm', ...fcm };

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@fintrack.local';
  if (!vapidPublicKey || !vapidPrivateKey || count <= 0) return { sent: 0, skipped: 'push_not_configured' };

  const { data: preferences } = await adminClient
    .from('push_preferences')
    .select('enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (preferences?.enabled === false) return { sent: 0, skipped: 'disabled' };

  const { data: subscriptions } = await adminClient
    .from('push_subscriptions')
    .select('id,endpoint,p256dh,auth')
    .eq('user_id', userId)
    .eq('enabled', true);

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify({
    title: 'FinTrack Pro',
    body: count === 1 ? 'Tienes 1 alerta financiera pendiente.' : `Tienes ${count} alertas financieras pendientes.`,
    url: '/?page=notificaciones',
    tag: `fintrack-alerts-${today()}`,
    type: 'alert',
    requireInteraction: false,
  });

  let sent = 0;
  for (const subscription of subscriptions || []) {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      }, payload);
      sent += 1;
      await adminClient.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', subscription.id);
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
      if ([404, 410].includes(statusCode)) {
        await adminClient.from('push_subscriptions').update({ enabled: false }).eq('id', subscription.id);
      }
    }
  }
  return { channel: 'web-push', sent };
}

async function generateForUser(adminClient: ReturnType<typeof createClient>, adminId: string) {
  const [
    deudasResult,
    presupuestosResult,
    movimientosResult,
    metasResult,
    cuentasResult,
    prestamosResult,
    readTodayResult,
  ] = await Promise.all([
    adminClient.from('deudas').select('id,descripcion,fecha_vencimiento,monto_total,monto_pagado').eq('admin_id', adminId),
    adminClient.from('presupuestos').select('id,categoria,tipo,monto_limite,tipo_movimiento_id,tipos_movimiento(nombre)').eq('admin_id', adminId).eq('mes', month()),
    adminClient.from('movimientos').select('id,tipo,categoria,tipo_movimiento_id,cuenta_id,monto,fecha').eq('admin_id', adminId).gte('fecha', `${month()}-01`).lte('fecha', today()),
    adminClient.from('metas').select('id,nombre,monto_objetivo,monto_actual,fecha_objetivo,estado').eq('admin_id', adminId).eq('estado', 'activa'),
    adminClient.from('cuentas').select('id,banco,tipo,tipo_entidad,cuenta_vinculada_id,saldo,moneda').eq('admin_id', adminId),
    adminClient.from('prestamos_recibidos').select('id,acreedor,descripcion,monto_original,saldo_inicial,monto_pagado,fecha_vencimiento').eq('admin_id', adminId),
    adminClient
      .from('app_notifications')
      .select('modulo,referencia_id,titulo')
      .eq('admin_id', adminId)
      .eq('leida', true)
      .gte('created_at', `${today()}T00:00:00`)
      .in('modulo', MANAGED_MODULES),
  ]);

  const notifications: Array<Record<string, unknown>> = [];

  for (const deuda of deudasResult.data || []) {
    const saldo = numberValue(deuda.monto_total) - numberValue(deuda.monto_pagado);
    const days = daysBetween(deuda.fecha_vencimiento);
    if (saldo <= 0 || days === null || days > 7) continue;
    notifications.push({
      admin_id: adminId,
      tipo: days < 0 ? 'danger' : 'warning',
      titulo: days < 0 ? 'Cuenta por cobrar vencida' : 'Cuenta por cobrar por vencer',
      mensaje: `${deuda.descripcion || 'Cuenta por cobrar'} tiene saldo pendiente S/ ${saldo.toFixed(2)}.`,
      modulo: 'deudas',
      referencia_id: deuda.id,
    });
  }

  for (const prestamo of prestamosResult.data || []) {
    const saldo = numberValue(prestamo.saldo_inicial || prestamo.monto_original) - numberValue(prestamo.monto_pagado);
    const days = daysBetween(prestamo.fecha_vencimiento);
    if (saldo <= 0 || days === null || days > 7) continue;
    notifications.push({
      admin_id: adminId,
      tipo: days < 0 ? 'danger' : 'warning',
      titulo: days < 0 ? 'Prestamo por pagar vencido' : 'Prestamo por pagar por vencer',
      mensaje: `${prestamo.acreedor || 'Acreedor'} tiene saldo pendiente S/ ${saldo.toFixed(2)}.`,
      modulo: 'prestamos-recibidos',
      referencia_id: prestamo.id,
    });
  }

  for (const cuenta of cuentasResult.data || []) {
    if (isLinkedWallet(cuenta) || numberValue(cuenta.saldo) > 20) continue;
    notifications.push({
      admin_id: adminId,
      tipo: 'warning',
      titulo: 'Saldo bajo',
      mensaje: `${cuenta.banco} ${cuenta.tipo || ''}: S/ ${numberValue(cuenta.saldo).toFixed(2)}.`,
      modulo: 'cuentas',
      referencia_id: cuenta.id,
    });
  }

  const movementAmounts = (movimientosResult.data || [])
    .map((movimiento) => numberValue(movimiento.monto))
    .filter((amount) => amount > 0);
  const averageAmount = movementAmounts.length
    ? movementAmounts.reduce((sum, amount) => sum + amount, 0) / movementAmounts.length
    : 0;
  const highMovementThreshold = Math.max(300, averageAmount * 2.5);
  for (const movimiento of movimientosResult.data || []) {
    const amount = numberValue(movimiento.monto);
    if (!amount || amount < highMovementThreshold) continue;
    notifications.push({
      admin_id: adminId,
      tipo: 'warning',
      titulo: 'Movimiento alto inusual',
      mensaje: `${movementLabel(movimiento)} por S/ ${amount.toFixed(2)} supera el comportamiento normal del mes.`,
      modulo: 'movimientos',
      referencia_id: movimiento.id,
    });
  }

  const lastMovementByAccount = new Map<string, string>();
  for (const movimiento of movimientosResult.data || []) {
    if (!movimiento.cuenta_id || !movimiento.fecha) continue;
    const current = lastMovementByAccount.get(movimiento.cuenta_id);
    if (!current || movimiento.fecha > current) lastMovementByAccount.set(movimiento.cuenta_id, movimiento.fecha);
  }
  for (const cuenta of cuentasResult.data || []) {
    if (isLinkedWallet(cuenta) || numberValue(cuenta.saldo) <= 0) continue;
    const lastMovement = lastMovementByAccount.get(cuenta.id);
    const days = lastMovement ? daysSince(lastMovement) : 31;
    if (days === null || days < 30) continue;
    notifications.push({
      admin_id: adminId,
      tipo: 'warning',
      titulo: 'Cuenta sin movimiento',
      mensaje: `${cuenta.banco} ${cuenta.tipo || ''} no registra movimientos hace ${lastMovement ? `${days} dias` : 'mas de 30 dias'}.`,
      modulo: 'cuentas',
      referencia_id: cuenta.id,
    });
  }

  for (const presupuesto of presupuestosResult.data || []) {
    const used = (movimientosResult.data || [])
      .filter((movimiento) => movimiento.tipo === presupuesto.tipo
        && ((presupuesto.tipo_movimiento_id && movimiento.tipo_movimiento_id === presupuesto.tipo_movimiento_id)
          || (!presupuesto.tipo_movimiento_id && (movimiento.categoria || '') === (presupuesto.categoria || ''))))
      .reduce((sum, movimiento) => sum + numberValue(movimiento.monto), 0);
    const limit = numberValue(presupuesto.monto_limite);
    const pct = limit ? Math.round((used / limit) * 100) : 0;
    if (!limit || pct < 80) continue;
    notifications.push({
      admin_id: adminId,
      tipo: pct >= 100 ? 'danger' : 'warning',
      titulo: pct >= 100 ? 'Presupuesto superado' : 'Presupuesto en alerta',
      mensaje: `${presupuesto.tipos_movimiento?.nombre || presupuesto.categoria || presupuesto.tipo}: ${pct}%.`,
      modulo: 'presupuestos',
      referencia_id: presupuesto.id,
    });
  }

  for (const meta of metasResult.data || []) {
    if (!meta.fecha_objetivo || meta.fecha_objetivo > today()) continue;
    notifications.push({
      admin_id: adminId,
      tipo: 'warning',
      titulo: 'Meta por revisar',
      mensaje: `${meta.nombre}: S/ ${numberValue(meta.monto_actual).toFixed(2)} / S/ ${numberValue(meta.monto_objetivo).toFixed(2)}.`,
      modulo: 'metas',
      referencia_id: meta.id,
    });
  }

  const readKeys = new Set((readTodayResult.data || []).map(notificationKey));
  const pendingNotifications = notifications.filter((notification) => !readKeys.has(notificationKey(notification)));

  await adminClient
    .from('app_notifications')
    .delete()
    .eq('admin_id', adminId)
    .eq('leida', false)
    .in('modulo', MANAGED_MODULES);

  if (!pendingNotifications.length) return { inserted: 0, push: { sent: 0 } };
  const { data: inserted, error } = await adminClient.from('app_notifications').insert(pendingNotifications).select('id');
  if (error) throw error;
  const push = await sendPushSummary(adminClient, adminId, inserted?.length || 0);
  return { inserted: inserted?.length || 0, push };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, 405, { error: 'Metodo no permitido.' });

  const url = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!url || !serviceKey || !anonKey) return jsonResponse(request, 500, { error: 'Faltan variables internas de Supabase.' });

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const authHeader = request.headers.get('Authorization') || '';
  const cronSecret = Deno.env.get('AUTO_ALERTS_SECRET') || '';
  const requestSecret = request.headers.get('x-auto-alerts-secret') || '';

  let body: { all?: boolean; user_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  let userIds: string[] = [];
  if (body.all) {
    if (!cronSecret) return jsonResponse(request, 500, { error: 'Falta configurar AUTO_ALERTS_SECRET en Supabase secrets.' });
    if (cronSecret && requestSecret !== cronSecret) return jsonResponse(request, 401, { error: 'Secreto de tarea automatica invalido.' });
    const { data, error } = await adminClient.from('profiles').select('id').eq('activo', true).is('deleted_at', null);
    if (error) return jsonResponse(request, 500, { error: error.message });
    userIds = (data || []).map((profile) => profile.id);
  } else if (body.user_id) {
    userIds = [body.user_id];
  } else {
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data.user) return jsonResponse(request, 401, { error: 'Sesion no valida.' });
    userIds = [data.user.id];
  }

  const results = [];
  for (const userId of userIds) {
    try {
      results.push({ user_id: userId, ...(await generateForUser(adminClient, userId)) });
    } catch (error) {
      results.push({ user_id: userId, error: error instanceof Error ? error.message : 'No se pudo generar alertas.' });
    }
  }

  return jsonResponse(request, 200, {
    processed: userIds.length,
    inserted: results.reduce((sum, item) => sum + Number((item as { inserted?: number }).inserted || 0), 0),
    results,
  });
});
