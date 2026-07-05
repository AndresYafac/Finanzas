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

export function registrarPago(supabase, payload) {
  return supabase.rpc('registrar_pago', payload);
}

export function actualizarPago(supabase, pagoId, payload) {
  return supabase.rpc('actualizar_pago', { p_pago_id: pagoId, ...payload });
}

export function eliminarPago(supabase, pagoId) {
  return supabase.rpc('eliminar_pago', { p_pago_id: pagoId });
}
