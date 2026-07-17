import { getAlertData } from './dashboard.service';
import { today } from '../utils/format';
import { getOperationalAccounts } from './cuentas.service';

const MANAGED_ALERT_MODULES = ['deudas', 'prestamos-recibidos', 'cuentas', 'presupuestos', 'metas', 'movimientos'];
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

function daysSince(dateValue) {
  if (!dateValue) return null;
  const start = new Date(`${dateValue}T00:00:00`);
  const end = new Date(`${today()}T00:00:00`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function numberValue(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function movementLabel(movement) {
  return movement.categoria || movement.tipo_movimiento_id || movement.tipo || 'Movimiento';
}

export async function generateAutomaticNotifications(supabase, adminId) {
  const data = await getAlertData(supabase, adminId);
  const notifications = [];

  data.deudas.forEach((deuda) => {
    const saldo = numberValue(deuda.monto_total) - numberValue(deuda.monto_pagado);
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
    const saldo = numberValue(prestamo.saldo_inicial || prestamo.monto_original) - numberValue(prestamo.monto_pagado);
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
    if (numberValue(cuenta.saldo) > 20) return;
    notifications.push({
      admin_id: adminId,
      tipo: 'warning',
      titulo: 'Saldo bajo',
      mensaje: `${cuenta.banco} ${cuenta.tipo || ''}: S/ ${numberValue(cuenta.saldo).toFixed(2)}.`,
      modulo: 'cuentas',
      referencia_id: cuenta.id,
    });
  });

  data.presupuestos.forEach((presupuesto) => {
    const used = data.movimientos
      .filter((movimiento) => movimiento.tipo === presupuesto.tipo
        && ((presupuesto.tipo_movimiento_id && movimiento.tipo_movimiento_id === presupuesto.tipo_movimiento_id)
          || (!presupuesto.tipo_movimiento_id && (movimiento.categoria || '') === (presupuesto.categoria || ''))))
      .reduce((sum, movimiento) => sum + numberValue(movimiento.monto), 0);
    const limit = numberValue(presupuesto.monto_limite);
    const pct = limit ? Math.round((used / limit) * 100) : 0;
    if (!limit || pct < 80) return;
    notifications.push({
      admin_id: adminId,
      tipo: pct >= 100 ? 'danger' : 'warning',
      titulo: pct >= 100 ? 'Presupuesto superado' : 'Presupuesto en alerta',
      mensaje: `${presupuesto.tipos_movimiento?.nombre || presupuesto.categoria || presupuesto.tipo}: ${pct}%.`,
      modulo: 'presupuestos',
      referencia_id: presupuesto.id,
    });
  });

  data.metas.forEach((meta) => {
    if (!meta.fecha_objetivo || meta.fecha_objetivo > today()) return;
    notifications.push({
      admin_id: adminId,
      tipo: 'warning',
      titulo: 'Meta por revisar',
      mensaje: `${meta.nombre}: S/ ${numberValue(meta.monto_actual).toFixed(2)} / S/ ${numberValue(meta.monto_objetivo).toFixed(2)}.`,
      modulo: 'metas',
      referencia_id: meta.id,
    });
  });

  const amounts = data.movimientos.map((movimiento) => numberValue(movimiento.monto)).filter((amount) => amount > 0);
  const averageAmount = amounts.length ? amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length : 0;
  const highMovementThreshold = Math.max(300, averageAmount * 2.5);
  data.movimientos.forEach((movimiento) => {
    const amount = numberValue(movimiento.monto);
    if (!amount || amount < highMovementThreshold) return;
    notifications.push({
      admin_id: adminId,
      tipo: 'warning',
      titulo: 'Movimiento alto inusual',
      mensaje: `${movementLabel(movimiento)} por S/ ${amount.toFixed(2)} supera el comportamiento normal del mes.`,
      modulo: 'movimientos',
      referencia_id: movimiento.id,
    });
  });

  const lastMovementByAccount = new Map();
  data.movimientos.forEach((movimiento) => {
    if (!movimiento.cuenta_id || !movimiento.fecha) return;
    const current = lastMovementByAccount.get(movimiento.cuenta_id);
    if (!current || movimiento.fecha > current) lastMovementByAccount.set(movimiento.cuenta_id, movimiento.fecha);
  });
  getOperationalAccounts(data.cuentas).forEach((cuenta) => {
    if (numberValue(cuenta.saldo) <= 0) return;
    const lastMovement = lastMovementByAccount.get(cuenta.id);
    const days = lastMovement ? daysSince(lastMovement) : 31;
    if (days === null || days < 30) return;
    notifications.push({
      admin_id: adminId,
      tipo: 'warning',
      titulo: 'Cuenta sin movimiento',
      mensaje: `${cuenta.banco} ${cuenta.tipo || ''} no registra movimientos hace ${lastMovement ? `${days} dias` : 'mas de 30 dias'}.`,
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
