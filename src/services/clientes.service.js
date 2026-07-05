import { createEntityService } from './entity.service';

export const clientesService = createEntityService('clientes');

export function searchClientes(supabase, adminId, term) {
  const like = `%${String(term || '').trim()}%`;
  return supabase
    .from('clientes')
    .select('*')
    .eq('admin_id', adminId)
    .or(`nombre.ilike.${like},apellido.ilike.${like},email.ilike.${like},telefono.ilike.${like}`)
    .order('created_at', { ascending: false });
}
