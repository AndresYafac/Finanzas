import { createEntityService } from './entity.service';

export const cuentasService = createEntityService('cuentas');

export function listarCuentasActivas(supabase, adminId) {
  return supabase
    .from('cuentas')
    .select('*')
    .eq('admin_id', adminId)
    .order('banco', { ascending: true });
}
