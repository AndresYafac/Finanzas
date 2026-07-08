import { cacheKey, invalidateCache, withCache } from './cache.service';

function scopedQuery(supabase, table, adminId) {
  return supabase.from(table).select('*').eq('admin_id', adminId);
}

export function createEntityService(table) {
  const prefix = `entity:${table}`;
  return {
    list(supabase, adminId, orderBy = 'created_at') {
      return scopedQuery(supabase, table, adminId).order(orderBy, { ascending: false });
    },
    listCached(supabase, adminId, options = {}) {
      const orderBy = options.orderBy || 'created_at';
      const ttlMs = options.ttlMs || 30000;
      const key = cacheKey(prefix, adminId, orderBy);
      return withCache(key, async () => {
        const { data, error } = await scopedQuery(supabase, table, adminId).order(orderBy, { ascending: false });
        return { data: data || [], error };
      }, ttlMs);
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
    invalidateCache(adminId) {
      invalidateCache(adminId ? cacheKey(prefix, adminId) : prefix);
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
