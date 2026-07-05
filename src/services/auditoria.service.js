export function listAuditoria(supabase, adminId, limit = 200) {
  return supabase
    .from('auditoria')
    .select('*')
    .eq('admin_id', adminId)
    .order('created_at', { ascending: false })
    .limit(limit);
}
