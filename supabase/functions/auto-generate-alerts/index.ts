import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const MANAGED_MODULES = ['deudas', 'prestamos-recibidos', 'cuentas', 'presupuestos', 'metas'];

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

async function sendPushSummary(adminClient: ReturnType<typeof createClient>, userId: string, count: number) {
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@fintrack.local';
  if (!vapidPublicKey || !vapidPrivateKey || count <= 0) return { sent: 0, skipped: 'vapid_not_configured' };

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
  return { sent };
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
    adminClient.from('movimientos').select('id,tipo,categoria,tipo_movimiento_id,monto,fecha').eq('admin_id', adminId).gte('fecha', `${month()}-01`).lte('fecha', today()),
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
