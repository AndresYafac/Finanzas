function scopedQuery(supabase, table, adminId) {
  return supabase.from(table).select('*').eq('admin_id', adminId);
}

export function createEntityService(table) {
  return {
    list(supabase, adminId, orderBy = 'created_at') {
      return scopedQuery(supabase, table, adminId).order(orderBy, { ascending: false });
    },
    getById(supabase, id) {
      return supabase.from(table).select('*').eq('id', id).single();
    },
    create(supabase, payload) {
      return supabase.from(table).insert(payload).select().single();
    },
    update(supabase, id, payload) {
      return supabase.from(table).update(payload).eq('id', id).select().single();
    },
    remove(supabase, id) {
      return supabase.from(table).delete().eq('id', id);
    },
  };
}

export function applyDateRange(query, field, from, to) {
  let nextQuery = query;
  if (from) nextQuery = nextQuery.gte(field, from);
  if (to) nextQuery = nextQuery.lte(field, to);
  return nextQuery;
}

export function applyIlike(query, field, value) {
  const term = String(value || '').trim();
  return term ? query.ilike(field, `%${term}%`) : query;
}
