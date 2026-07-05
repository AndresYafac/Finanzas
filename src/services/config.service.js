export function getEmpresaConfig(client) {
  return client.from('empresa_config').select('*').maybeSingle();
}

export function testSupabaseConnection(client) {
  return client.from('profiles').select('id').limit(1);
}

export function saveEmpresaConfig(client, adminId, company) {
  return client
    .from('empresa_config')
    .upsert({ admin_id: adminId, ...company, updated_at: new Date().toISOString() }, { onConflict: 'admin_id' });
}

export function uploadEmpresaLogo(client, path, file) {
  return client.storage.from('empresa-assets').upload(path, file, { upsert: true });
}

export function getEmpresaLogoUrl(client, path) {
  return client.storage.from('empresa-assets').getPublicUrl(path);
}
