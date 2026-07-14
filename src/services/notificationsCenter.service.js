import { getAlertData } from './dashboard.service';
import { today } from '../utils/format';
import { getOperationalAccounts } from './cuentas.service';

const MANAGED_ALERT_MODULES = ['deudas', 'prestamos-recibidos', 'cuentas', 'presupuestos', 'metas'];
const AUTO_ALERTS_INTERVAL_MS = 10 * 60 * 1000;

export function listInternalNotifications(supabase, adminId) {
  return supabase
    .from('app_notifications')
    .select('*')
    .eq('admin_id', adminId)
    .order('created_at', { ascending: false });
}

export function markNotificationRead(supabase, id, read = true) {
  return supabase.from('app_notifications').update({ leida: read }).eq('id', id);
}

export function deleteNotification(supabase, id) {
  return supabase.from('app_notifications').delete().eq('id', id);
}

export async function createInternalNotification(supabase, payload) {
  return supabase.from('app_notifications').insert(payload).select().single();
}

function notificationKey(notification) {
  return [
    notification.modulo || '',
    notification.referencia_id || '',
    notification.titulo || '',
  ].join('|');
}

function daysBetween(dateValue) {
  if (!dateValue) return null;
  const start = new Date(`${today()}T00:00:00`);
  const end = new Date(`${dateValue}T00:00:00`);
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

export async function generateAutomaticNotifications(supabase, adminId) {
  const data = await getAlertData(supabase, adminId);
  const notifications = [];

  data.deudas.forEach((deuda) => {
    const saldo = Number(deuda.monto_total || 0) - Number(deuda.monto_pagado || 0);
    const days = daysBetween(deuda.fecha_vencimiento);
    if (saldo <= 0 || days === null || days > 7) return;
    notifications.push({
      admin_id: adminId,
      tipo: days < 0 ? 'danger' : 'warning',
      titulo: days < 0 ? 'Cuenta por cobrar vencida' : 'Cuenta por cobrar por vencer',
      mensaje: `${deuda.descripcion || 'Cuenta por cobrar'} tiene saldo pendiente S/ ${saldo.toFixed(2)}.`,
      modulo: 'deudas',
      referencia_id: deuda.id,
    });
  });

  data.prestamosRecibidos.forEach((prestamo) => {
    const saldo = Number(prestamo.saldo_inicial || prestamo.monto_original || 0) - Number(prestamo.monto_pagado || 0);
    const days = daysBetween(prestamo.fecha_vencimiento);
    if (saldo <= 0 || days === null || days > 7) return;
    notifications.push({
      admin_id: adminId,
      tipo: days < 0 ? 'danger' : 'warning',
      titulo: days < 0 ? 'Prestamo por pagar vencido' : 'Prestamo por pagar por vencer',
      mensaje: `${prestamo.acreedor || 'Acreedor'} tiene saldo pendiente S/ ${saldo.toFixed(2)}.`,
      modulo: 'prestamos-recibidos',
      referencia_id: prestamo.id,
    });
  });

  getOperationalAccounts(data.cuentas).forEach((cuenta) => {
    if (Number(cuenta.saldo || 0) > 20) return;
    notifications.push({
      admin_id: adminId,
      tipo: 'warning',
      titulo: 'Saldo bajo',
      mensaje: `${cuenta.banco} ${cuenta.tipo || ''}: S/ ${Number(cuenta.saldo || 0).toFixed(2)}.`,
      modulo: 'cuentas',
      referencia_id: cuenta.id,
    });
  });

  const { data: readToday, error: readError } = await supabase
    .from('app_notifications')
    .select('modulo,referencia_id,titulo')
    .eq('admin_id', adminId)
    .eq('leida', true)
    .gte('created_at', `${today()}T00:00:00`)
    .in('modulo', MANAGED_ALERT_MODULES);

  if (readError) return { data: [], error: readError };

  const readTodayKeys = new Set((readToday || []).map(notificationKey));
  const pendingNotifications = notifications.filter((notification) => !readTodayKeys.has(notificationKey(notification)));

  const { error: deleteError } = await supabase
    .from('app_notifications')
    .delete()
    .eq('admin_id', adminId)
    .eq('leida', false)
    .in('modulo', MANAGED_ALERT_MODULES);

  if (deleteError) return { data: [], error: deleteError };
  if (!pendingNotifications.length) return { data: [], error: null };
  const { data: inserted, error } = await supabase.from('app_notifications').insert(pendingNotifications).select();
  return { data: inserted || [], error };
}

export async function syncAutomaticNotifications(supabase, adminId, options = {}) {
  const { force = false } = options;
  const key = `fintrack:auto-alerts:${adminId}`;
  const lastRun = Number(localStorage.getItem(key) || 0);
  if (!force && Date.now() - lastRun < AUTO_ALERTS_INTERVAL_MS) {
    return { data: [], skipped: true, error: null };
  }

  const result = await generateAutomaticNotifications(supabase, adminId);
  if (!result.error) localStorage.setItem(key, String(Date.now()));
  return { ...result, skipped: false };
}
