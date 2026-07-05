export function getProfile(supabase, userId) {
  return supabase.from('profiles').select('*').eq('id', userId).single();
}

export function listUserPermissions(supabase, userId) {
  return supabase.from('user_permissions').select('*').eq('user_id', userId);
}

export function listAdminUsers(supabase) {
  return supabase.rpc('admin_listar_usuarios');
}

export function updateAdminUser(supabase, payload) {
  return supabase.rpc('admin_actualizar_usuario', payload);
}

export function updateAdminUserState(supabase, userId, active) {
  return supabase.rpc('admin_actualizar_usuario_estado', { p_user_id: userId, p_activo: active });
}

export function deleteAdminUser(supabase, userId) {
  return supabase.rpc('admin_eliminar_usuario', { p_user_id: userId });
}

export function listPermissionsForUser(supabase, userId) {
  return supabase.from('user_permissions').select('*').eq('user_id', userId);
}

export function savePermissions(supabase, rows) {
  return supabase.from('user_permissions').upsert(rows, { onConflict: 'user_id,modulo' });
}
