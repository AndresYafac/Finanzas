export function listAuditoria(supabase, adminId, limit = 200) {
  return supabase
    .from('auditoria')
    .select('*')
    .eq('admin_id', adminId)
    .order('created_at', { ascending: false })
    .limit(limit);
}

export async function logAuditoria(supabase, adminId, tabla, accion, descripcion, registroId = null, datos = null) {
  if (!supabase || !adminId) return { error: null };

  const safeDatos = datos && typeof datos === 'object' ? datos : { detalle: datos };
  const rpcPayload = {
    p_tabla: tabla,
    p_accion: accion,
    p_descripcion: descripcion,
    p_registro_id: registroId,
    p_datos_antes: accion === 'delete' ? safeDatos : null,
    p_datos_despues: accion === 'delete' ? null : safeDatos,
  };

  const { error: rpcError } = await supabase.rpc('registrar_auditoria_avanzada', rpcPayload);
  if (!rpcError) return { error: null };

  const { error } = await supabase.from('auditoria').insert({
    admin_id: adminId,
    tabla,
    accion,
    descripcion,
    registro_id: registroId,
    datos: safeDatos,
  });
  return { error };
}
