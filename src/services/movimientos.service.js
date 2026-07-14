import { validateFinanceOperationIfAvailable } from './backend.service';

export function listMovimientosViewData(supabase, adminId) {
  return Promise.all([
    supabase.from('movimientos').select('*,tipos_movimiento(nombre),cuentas(banco,tipo)').eq('admin_id', adminId).order('fecha', { ascending: false }),
    supabase.from('tipos_movimiento').select('*').eq('admin_id', adminId).order('tipo').order('nombre'),
    supabase.from('cuentas').select('*').eq('admin_id', adminId).order('banco'),
  ]);
}

export async function registrarMovimiento(supabase, payload) {
  const validation = await validateFinanceOperationIfAvailable(supabase, {
    operation: payload.p_tipo,
    tipo: payload.p_tipo,
    monto: payload.p_monto,
    cuenta_id: payload.p_cuenta_id,
  });
  if (validation.error || validation.data?.ok === false) return validation;

  return supabase.rpc('registrar_movimiento_financiero', payload);
}

export function actualizarMovimiento(supabase, movimientoId, payload) {
  return supabase.rpc('actualizar_movimiento_financiero', { p_movimiento_id: movimientoId, ...payload });
}

export function eliminarMovimiento(supabase, movimientoId) {
  return supabase.rpc('eliminar_movimiento_financiero', { p_movimiento_id: movimientoId });
}

export function crearTipoMovimiento(supabase, adminId, payload) {
  return supabase.from('tipos_movimiento').insert({ ...payload, admin_id: adminId });
}

export function actualizarTipoMovimiento(supabase, adminId, id, payload) {
  return supabase.from('tipos_movimiento').update(payload).eq('id', id).eq('admin_id', adminId);
}

export function eliminarTipoMovimiento(supabase, adminId, id) {
  return supabase.from('tipos_movimiento').delete().eq('id', id).eq('admin_id', adminId);
}
