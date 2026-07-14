export function listCategoryRules(supabase, adminId) {
  return supabase.from('category_rules').select('*,tipos_movimiento(nombre)').eq('admin_id', adminId).order('created_at', { ascending: false });
}

export function createCategoryRule(supabase, adminId, payload) {
  return supabase.from('category_rules').insert({ ...payload, admin_id: adminId }).select().single();
}

export function updateCategoryRule(supabase, id, payload) {
  return supabase.from('category_rules').update(payload).eq('id', id).select().single();
}

export function deleteCategoryRule(supabase, id) {
  return supabase.from('category_rules').delete().eq('id', id);
}

export function suggestCategoryFromRules(concepto, rules = []) {
  const text = String(concepto || '').toLowerCase();
  return rules.find((rule) => rule.activo !== false && text.includes(String(rule.keyword || '').toLowerCase())) || null;
}
