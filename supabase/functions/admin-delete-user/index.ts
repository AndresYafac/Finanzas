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

  let body: { userId?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, 400, { error: 'Body JSON invalido.' });
  }

  const targetUserId = String(body.userId || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
    return jsonResponse(request, 400, { error: 'Usuario invalido.' });
  }

  try {
    const { userClient, adminClient } = getSupabaseClients(request);
    const { data: authData, error: authError } = await userClient.auth.getUser();

    if (authError || !authData.user) {
      return jsonResponse(request, 401, { error: 'Sesion no valida.' });
    }

    const currentUserId = authData.user.id;
    if (currentUserId === targetUserId) {
      return jsonResponse(request, 400, { error: 'No puedes eliminar tu propio usuario.' });
    }

    const { data: currentProfile, error: currentProfileError } = await adminClient
      .from('profiles')
      .select('id,role,activo,deleted_at')
      .eq('id', currentUserId)
      .single();

    if (currentProfileError || !currentProfile || currentProfile.role !== 'admin' || currentProfile.activo === false || currentProfile.deleted_at) {
      return jsonResponse(request, 403, { error: 'No autorizado. Solo un administrador activo puede eliminar usuarios.' });
    }

    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('id,email_contacto,role')
      .eq('id', targetUserId)
      .maybeSingle();

    if (!targetProfile) {
      return jsonResponse(request, 404, { error: 'El perfil del usuario no existe.' });
    }

    await adminClient.from('user_permissions').delete().eq('user_id', targetUserId);
    await adminClient.from('clientes').update({ user_id: null }).eq('user_id', targetUserId);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (deleteError) {
      return jsonResponse(request, 500, { error: deleteError.message });
    }

    return jsonResponse(request, 200, {
      data: {
        deleted: true,
        user_id: targetUserId,
        email: targetProfile.email_contacto || null,
      },
    });
  } catch (error) {
    return jsonResponse(request, 500, {
      error: error instanceof Error ? error.message : 'No se pudo eliminar el usuario.',
    });
  }
});
