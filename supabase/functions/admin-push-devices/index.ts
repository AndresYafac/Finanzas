import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function getCorsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '';
  const allowOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin)
    ? (allowedOrigins.includes('*') ? '*' : origin)
    : allowedOrigins[0] || '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function jsonResponse(request: Request, status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...getCorsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function getSupabaseClients(request: Request) {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const authorization = request.headers.get('Authorization') || '';

  if (!url || !anonKey || !serviceKey) {
    throw new Error('Faltan variables internas de Supabase para ejecutar la funcion.');
  }

  return {
    userClient: createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    adminClient: createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, 405, { error: 'Metodo no permitido.' });
  }

  try {
    const { userClient, adminClient } = getSupabaseClients(request);
    const { data: authData, error: authError } = await userClient.auth.getUser();

    if (authError || !authData.user) {
      return jsonResponse(request, 401, { error: 'Sesion no valida.' });
    }

    const currentUserId = authData.user.id;
    const { data: currentProfile, error: currentProfileError } = await adminClient
      .from('profiles')
      .select('id,role,activo,deleted_at')
      .eq('id', currentUserId)
      .single();

    if (currentProfileError || !currentProfile || currentProfile.role !== 'admin' || currentProfile.activo === false || currentProfile.deleted_at) {
      return jsonResponse(request, 403, { error: 'No autorizado. Solo un administrador activo puede ver dispositivos push.' });
    }

    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id,nombre,apellido,email_contacto,role,activo,deleted_at,created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (profilesError) {
      return jsonResponse(request, 500, { error: profilesError.message });
    }

    const userIds = (profiles || []).map((profile) => profile.id);
    const { data: devices, error: devicesError } = userIds.length
      ? await adminClient
        .from('mobile_push_devices')
        .select('id,user_id,platform,device_name,enabled,last_used_at,updated_at')
        .in('user_id', userIds)
        .order('updated_at', { ascending: false })
      : { data: [], error: null };

    if (devicesError && devicesError.code !== '42P01') {
      return jsonResponse(request, 500, { error: devicesError.message });
    }

    const devicesByUser = new Map<string, Array<Record<string, unknown>>>();
    for (const device of devices || []) {
      const key = String(device.user_id);
      const list = devicesByUser.get(key) || [];
      list.push(device);
      devicesByUser.set(key, list);
    }

    const rows = (profiles || []).map((profile) => {
      const userDevices = devicesByUser.get(profile.id) || [];
      const activeDevices = userDevices.filter((device) => device.enabled);
      const latestDevice = userDevices[0] || null;
      return {
        user_id: profile.id,
        nombre: profile.nombre,
        apellido: profile.apellido,
        email: profile.email_contacto,
        role: profile.role,
        activo: profile.activo,
        registered: activeDevices.length > 0,
        devices_count: userDevices.length,
        active_devices_count: activeDevices.length,
        platform: latestDevice?.platform || null,
        device_name: latestDevice?.device_name || null,
        last_used_at: latestDevice?.last_used_at || latestDevice?.updated_at || null,
      };
    });

    return jsonResponse(request, 200, {
      devices: rows,
      summary: {
        users: rows.length,
        registered: rows.filter((row) => row.registered).length,
        not_registered: rows.filter((row) => !row.registered).length,
        active_devices: rows.reduce((sum, row) => sum + Number(row.active_devices_count || 0), 0),
      },
    });
  } catch (error) {
    return jsonResponse(request, 500, {
      error: error instanceof Error ? error.message : 'No se pudo listar dispositivos push.',
    });
  }
});
