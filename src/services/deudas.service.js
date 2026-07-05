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
