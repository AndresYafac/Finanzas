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

function cleanText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function cleanEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Correo de acceso invalido.');
  }
  return email;
}

function getClients(request: Request) {
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

  let body: { userId?: unknown; email?: unknown; profile?: Record<string, unknown> };
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
    const { userClient, adminClient } = getClients(request);
    const { data: authData, error: authError } = await userClient.auth.getUser();

    if (authError || !authData.user) {
      return jsonResponse(request, 401, { error: 'Sesion no valida.' });
    }

    const currentUserId = authData.user.id;
    if (currentUserId === targetUserId) {
      return jsonResponse(request, 400, { error: 'Edita tu propio usuario desde Mi perfil.' });
    }

    const { data: currentProfile, error: currentProfileError } = await adminClient
      .from('profiles')
      .select('id,role,activo,deleted_at')
      .eq('id', currentUserId)
      .single();

    if (currentProfileError || !currentProfile || currentProfile.role !== 'admin' || currentProfile.activo === false || currentProfile.deleted_at) {
      return jsonResponse(request, 403, { error: 'No autorizado. Solo un administrador activo puede editar usuarios.' });
    }

    const profile = body.profile || {};
    const role = cleanText(profile.role) || 'user';
    if (!['admin', 'user'].includes(role)) {
      return jsonResponse(request, 400, { error: 'Rol invalido.' });
    }

    const email = cleanEmail(body.email);
    if (email) {
      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        email,
        email_confirm: true,
      });
      if (updateAuthError) {
        return jsonResponse(request, 400, { error: updateAuthError.message });
      }
    }

    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        nombre: cleanText(profile.nombre),
        apellido: cleanText(profile.apellido),
        tipo_doc: cleanText(profile.tipo_doc) || 'DNI',
        documento: cleanText(profile.documento),
        email_contacto: cleanText(profile.email_contacto),
        telefono: cleanText(profile.telefono),
        direccion: cleanText(profile.direccion),
        empresa: cleanText(profile.empresa),
        moneda: cleanText(profile.moneda) || 'PEN',
        role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId);

    if (profileError) {
      return jsonResponse(request, 400, { error: profileError.message });
    }

    return jsonResponse(request, 200, { data: { updated: true, user_id: targetUserId, email } });
  } catch (error) {
    return jsonResponse(request, 500, {
      error: error instanceof Error ? error.message : 'No se pudo actualizar el usuario.',
    });
  }
});
