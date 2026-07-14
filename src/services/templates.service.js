export function listMovementTemplates(supabase, adminId) {
  return supabase.from('movement_templates').select('*,tipos_movimiento(nombre),cuentas(banco,tipo)').eq('admin_id', adminId).order('created_at', { ascending: false });
}

export function createMovementTemplate(supabase, adminId, payload) {
  return supabase.from('movement_templates').insert({ ...payload, admin_id: adminId }).select().single();
}

export function updateMovementTemplate(supabase, id, payload) {
  return supabase.from('movement_templates').update(payload).eq('id', id).select().single();
}

export function deleteMovementTemplate(supabase, id) {
  return supabase.from('movement_templates').delete().eq('id', id);
}
