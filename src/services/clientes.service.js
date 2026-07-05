import { createEntityService } from './entity.service';

export const clientesService = createEntityService('clientes');

export function listClientes(supabase, adminId) {
  return supabase
    .from('clientes')
    .select('*')
    .eq('admin_id', adminId)
    .order('created_at', { ascending: false });
}

export function createCliente(supabase, adminId, payload) {
  return supabase.from('clientes').insert({ ...payload, admin_id: adminId });
}

export function updateCliente(supabase, adminId, id, payload) {
  return supabase.from('clientes').update(payload).eq('id', id).eq('admin_id', adminId);
}

export function deleteCliente(supabase, adminId, id) {
  return supabase.from('clientes').delete().eq('id', id).eq('admin_id', adminId);
}

export function searchClientes(supabase, adminId, term) {
  const like = `%${String(term || '').trim()}%`;
  return supabase
    .from('clientes')
    .select('*')
    .eq('admin_id', adminId)
    .or(`nombre.ilike.${like},apellido.ilike.${like},email.ilike.${like},telefono.ilike.${like}`)
    .order('created_at', { ascending: false });
}
