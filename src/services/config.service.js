export function getEmpresaConfig(client) {
  return client.from('empresa_config').select('*').maybeSingle();
}

export function testSupabaseConnection(client) {
  return client.from('profiles').select('id').limit(1);
}

export async function saveEmpresaConfig(client, adminId, company) {
  const payload = {
    admin_id: adminId,
    nombre: company.nombre,
    documento: company.documento,
    direccion: company.direccion,
    telefono: company.telefono,
    logo_url: company.logo_url,
    updated_at: new Date().toISOString(),
  };
  const result = await client
    .from('empresa_config')
    .upsert(payload, { onConflict: 'admin_id' });

  if (!result.error || !/column|schema cache|Could not find/i.test(result.error.message || '')) {
    return result;
  }

  const legacyPayload = {
    admin_id: adminId,
    nombre: company.nombre,
    documento: company.documento,
    direccion: company.direccion,
    telefono: company.telefono,
    logo_url: company.logo_url,
    updated_at: payload.updated_at,
  };

  return client
    .from('empresa_config')
    .upsert(legacyPayload, { onConflict: 'admin_id' });
}

export function uploadEmpresaLogo(client, path, file) {
  return client.storage.from('empresa-assets').upload(path, file, { upsert: true });
}

export function getEmpresaLogoUrl(client, path) {
  return client.storage.from('empresa-assets').getPublicUrl(path);
}
