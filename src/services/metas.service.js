export function listMetas(supabase, adminId) {
  return supabase.from('metas').select('*').eq('admin_id', adminId).order('created_at', { ascending: false });
}

export function createMeta(supabase, payload) {
  return supabase.from('metas').insert(payload);
}

export function updateMeta(supabase, adminId, id, payload) {
  return supabase.from('metas').update(payload).eq('id', id).eq('admin_id', adminId);
}

export function deleteMeta(supabase, adminId, id) {
  return supabase.from('metas').delete().eq('id', id).eq('admin_id', adminId);
}
