export async function globalSearch(supabase, adminId, rawTerm) {
  const term = String(rawTerm || '').trim().replace(/[,%()]/g, ' ');
  if (term.length < 2) return [];
  const like = `%${term}%`;
  const [clientes, cuentas, deudas, pagos, movimientos] = await Promise.all([
    supabase.from('clientes').select('id,nombre,apellido,email,telefono').eq('admin_id', adminId).or(`nombre.ilike.${like},apellido.ilike.${like},email.ilike.${like},telefono.ilike.${like}`).limit(5),
    supabase.from('cuentas').select('id,banco,tipo,moneda').eq('admin_id', adminId).or(`banco.ilike.${like},tipo.ilike.${like}`).limit(5),
    supabase.from('deudas').select('id,descripcion,tipo,clientes(nombre,apellido)').eq('admin_id', adminId).or(`descripcion.ilike.${like},tipo.ilike.${like}`).limit(5),
    supabase.from('pagos').select('id,referencia,metodo,clientes(nombre,apellido)').eq('admin_id', adminId).or(`referencia.ilike.${like},metodo.ilike.${like},notas.ilike.${like}`).limit(5),
    supabase.from('movimientos').select('id,descripcion,categoria,tipo').eq('admin_id', adminId).or(`descripcion.ilike.${like},categoria.ilike.${like},tipo.ilike.${like}`).limit(5),
  ]);

  return [
    ...(clientes.data || []).map((row) => ({ page: 'clientes', title: `${row.nombre || ''} ${row.apellido || ''}`.trim() || 'Cliente', meta: row.email || row.telefono || 'Cliente', type: 'Cliente' })),
    ...(cuentas.data || []).map((row) => ({ page: 'cuentas', title: row.banco || 'Cuenta', meta: `${row.tipo || '-'} · ${row.moneda || 'PEN'}`, type: 'Cuenta' })),
    ...(deudas.data || []).map((row) => ({ page: row.tipo === 'Préstamo' ? 'prestamos' : 'deudas', title: row.descripcion || row.tipo || 'Pendiente', meta: `${row.clientes?.nombre || ''} ${row.clientes?.apellido || ''}`.trim(), type: row.tipo === 'Préstamo' ? 'Préstamo' : 'Pendiente' })),
    ...(pagos.data || []).map((row) => ({ page: 'pagos', title: row.referencia || row.metodo || 'Cobro', meta: `${row.clientes?.nombre || ''} ${row.clientes?.apellido || ''}`.trim(), type: 'Cobro' })),
    ...(movimientos.data || []).map((row) => ({ page: 'movimientos', title: row.descripcion || row.categoria || 'Movimiento', meta: row.tipo, type: 'Movimiento' })),
  ].slice(0, 8);
}
