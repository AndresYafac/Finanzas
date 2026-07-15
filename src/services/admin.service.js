export function getProfile(supabase, userId) {
  return supabase.from('profiles').select('*').eq('id', userId).single();
}

export function listUserPermissions(supabase, userId) {
  return supabase.from('user_permissions').select('*').eq('user_id', userId);
}

export function listAdminUsers(supabase) {
  return supabase.rpc('admin_listar_usuarios');
}

export async function updateAdminUser(supabase, payload) {
  const edgeResult = await supabase.functions.invoke('admin-update-user', {
    body: {
      userId: payload.p_user_id,
      email: payload.p_email_auth,
      profile: {
        nombre: payload.p_nombre,
        apellido: payload.p_apellido,
        tipo_doc: payload.p_tipo_doc,
        documento: payload.p_documento,
        email_contacto: payload.p_email_contacto,
        telefono: payload.p_telefono,
        direccion: payload.p_direccion,
        empresa: payload.p_empresa,
        moneda: payload.p_moneda,
        role: payload.p_role,
      },
    },
  });

  if (!edgeResult.error) {
    return edgeResult;
  }

  const message = edgeResult.error?.message || '';
  const isFunctionUnavailable = /failed to send|not found|404|function/i.test(message);

  if (!isFunctionUnavailable) {
    return edgeResult;
  }

  return supabase.rpc('admin_actualizar_usuario', payload);
}

export function updateAdminUserState(supabase, userId, active) {
  return supabase.rpc('admin_actualizar_usuario_estado', { p_user_id: userId, p_activo: active });
}

export async function deleteAdminUser(supabase, userId) {
  const edgeResult = await supabase.functions.invoke('admin-delete-user', {
    body: { userId },
  });

  if (!edgeResult.error) {
    return edgeResult;
  }

  const message = edgeResult.error?.message || '';
  const isFunctionUnavailable = /failed to send|not found|404|function/i.test(message);

  if (!isFunctionUnavailable) {
    return edgeResult;
  }

  return supabase.rpc('admin_eliminar_usuario', { p_user_id: userId });
}

export function listPermissionsForUser(supabase, userId) {
  return supabase.from('user_permissions').select('*').eq('user_id', userId);
}

export function savePermissions(supabase, rows) {
  return supabase.from('user_permissions').upsert(rows, { onConflict: 'user_id,modulo' });
}
