import { applyDateRange, createEntityService } from './entity.service';

export const deudasService = createEntityService('deudas');

export function listarDeudasFiltradas(supabase, adminId, filters = {}) {
  let query = supabase
    .from('deudas')
    .select('*, clientes(nombre,apellido)')
    .eq('admin_id', adminId);
  if (filters.cliente_id) query = query.eq('cliente_id', filters.cliente_id);
  if (filters.tipo) query = query.eq('tipo', filters.tipo);
  query = applyDateRange(query, 'fecha_vencimiento', filters.desde, filters.hasta);
  return query.order('fecha_vencimiento', { ascending: true });
}

export function listDeudasViewData(supabase, adminId) {
  return Promise.all([
    supabase.from('deudas').select('*,clientes(nombre,apellido,user_id),cuentas(banco,tipo)').eq('admin_id', adminId).order('fecha_vencimiento'),
    supabase.from('clientes').select('*').eq('admin_id', adminId).order('nombre'),
    supabase.from('cuentas').select('*').eq('admin_id', adminId).order('banco'),
  ]);
}

export function createDeuda(supabase, payload) {
  return supabase.from('deudas').insert(payload);
}

export function updateDeuda(supabase, adminId, id, payload) {
  return supabase.from('deudas').update(payload).eq('id', id).eq('admin_id', adminId);
}

export function deleteDeuda(supabase, adminId, id) {
  return supabase.from('deudas').delete().eq('id', id).eq('admin_id', adminId);
}

export function registrarDeudaConDesembolso(supabase, payload) {
  return supabase.rpc('registrar_deuda_con_desembolso', payload);
}

export function actualizarPrestamoPorCobrar(supabase, deudaId, payload) {
  return supabase.rpc('actualizar_prestamo', { p_deuda_id: deudaId, ...payload });
}

export function eliminarPrestamoPorCobrar(supabase, deudaId) {
  return supabase.rpc('eliminar_prestamo', { p_deuda_id: deudaId });
}
