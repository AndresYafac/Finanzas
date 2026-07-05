export async function exportTablesData(supabase, adminId, tables) {
  const result = {};
  await Promise.all(tables.map(async (table) => {
    const query = supabase.from(table).select('*');
    const { data } = table === 'profiles' ? await query.eq('id', adminId) : await query.eq('admin_id', adminId);
    result[table] = data || [];
  }));
  return result;
}

export function exportTableRows(supabase, adminId, table) {
  const query = supabase.from(table).select('*');
  return table === 'profiles' ? query.eq('id', adminId) : query.eq('admin_id', adminId);
}

export function importRows(supabase, type, rows) {
  return supabase.from(type === 'clientes' ? 'clientes' : 'movimientos').insert(rows);
}
