import { createEntityService } from './entity.service';

export const presupuestosService = createEntityService('presupuestos');

export function listPresupuestosViewData(supabase, adminId) {
  return Promise.all([
    supabase.from('presupuestos').select('*,tipos_movimiento(nombre)').eq('admin_id', adminId).order('mes', { ascending: false }),
    supabase.from('tipos_movimiento').select('*').eq('admin_id', adminId).order('tipo').order('nombre'),
    supabase.from('movimientos').select('*').eq('admin_id', adminId),
  ]);
}

export function createPresupuesto(supabase, payload) {
  return supabase.from('presupuestos').insert(payload);
}

export function updatePresupuesto(supabase, adminId, id, payload) {
  return supabase.from('presupuestos').update(payload).eq('id', id).eq('admin_id', adminId);
}

export function deletePresupuesto(supabase, adminId, id) {
  return supabase.from('presupuestos').delete().eq('id', id).eq('admin_id', adminId);
}
