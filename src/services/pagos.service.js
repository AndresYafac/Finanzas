import { validateFinanceOperationIfAvailable } from './backend.service';

export function listPagosGenerales(supabase, adminId) {
  return supabase
    .from('pagos')
    .select('*,clientes(nombre,apellido,user_id),deudas(descripcion),cuentas(banco)')
    .eq('admin_id', adminId)
    .order('fecha', { ascending: false });
}

export function listPagoFormData(supabase, adminId) {
  return Promise.all([
    supabase.from('clientes').select('*').eq('admin_id', adminId).order('nombre'),
    supabase.from('deudas').select('*,clientes(nombre,apellido,user_id)').eq('admin_id', adminId),
    supabase.from('cuentas').select('*').eq('admin_id', adminId),
  ]);
}

export async function registrarPago(supabase, payload) {
  const validation = await validateFinanceOperationIfAvailable(supabase, {
    operation: 'pago_deuda',
    monto: payload.p_monto,
    cuenta_id: payload.p_cuenta_id,
    deuda_id: payload.p_deuda_id,
  });
  if (validation.error || validation.data?.ok === false) return validation;

  return supabase.rpc('registrar_pago', payload);
}

export function actualizarPago(supabase, pagoId, payload) {
  return supabase.rpc('actualizar_pago', { p_pago_id: pagoId, ...payload });
}

export function eliminarPago(supabase, pagoId) {
  return supabase.rpc('eliminar_pago', { p_pago_id: pagoId });
}
