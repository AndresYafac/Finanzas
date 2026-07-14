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

function normalizeType(tipo: unknown, documento: string) {
  const raw = String(tipo || '').trim().toLowerCase();
  if (documento.length === 8) return 'dni';
  if (documento.length === 11) return 'ruc';
  if (raw === 'dni' || raw === 'ruc') return raw;
  return '';
}

function normalizePerson(data: unknown) {
  const source = Array.isArray(data) ? data[0] : data;
  if (!source || typeof source !== 'object') return null;
  const value = source as Record<string, string | undefined>;
  const razonSocial = value.razonSocial || value.razon_social || '';
  const nombres = value.nombres || value.nombre || value.nombre_completo || '';
  const apellido = [
    value.apellidoPaterno,
    value.apellido_paterno,
    value.apellidoMaterno,
    value.apellido_materno,
  ].filter(Boolean).join(' ');

  return {
    nombre: razonSocial || nombres,
    apellido: razonSocial ? '' : apellido,
    direccion: value.direccion || value.address || '',
    raw: data,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, 405, { error: 'Metodo no permitido.' });
  }

  const token = Deno.env.get('APISPERU_TOKEN') || '';
  if (!token) {
    return jsonResponse(request, 500, { error: 'Falta configurar APISPERU_TOKEN en Supabase.' });
  }

  let body: { tipo?: unknown; documento?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, 400, { error: 'Body JSON invalido.' });
  }

  const documento = String(body.documento || '').trim();
  const tipo = normalizeType(body.tipo, documento);

  if (!['dni', 'ruc'].includes(tipo)) {
    return jsonResponse(request, 400, { error: 'Tipo de documento invalido. Usa DNI de 8 digitos o RUC de 11 digitos.' });
  }

  if ((tipo === 'dni' && !/^\d{8}$/.test(documento)) || (tipo === 'ruc' && !/^\d{11}$/.test(documento))) {
    return jsonResponse(request, 400, { error: tipo === 'dni' ? 'El DNI debe tener 8 digitos.' : 'El RUC debe tener 11 digitos.' });
  }

  try {
    const url = `https://dniruc.apisperu.com/api/v1/${tipo}/${encodeURIComponent(documento)}?token=${encodeURIComponent(token)}`;
    const apiResponse = await fetch(url, { headers: { accept: 'application/json' } });
    const text = await apiResponse.text();
    let providerPayload: unknown;

    try {
      providerPayload = text ? JSON.parse(text) : {};
    } catch {
      providerPayload = { error: text || 'Respuesta invalida del proveedor.' };
    }

    if (!apiResponse.ok) {
      const payload = providerPayload as Record<string, string | undefined>;
      return jsonResponse(request, apiResponse.status, {
        error: payload?.message || payload?.error || `No se pudo consultar el documento (${apiResponse.status}).`,
      });
    }

    const person = normalizePerson(providerPayload);
    if (!person?.nombre) {
      return jsonResponse(request, 404, { error: 'La API no devolvio datos reconocibles.', raw: providerPayload as Record<string, unknown> });
    }

    return jsonResponse(request, 200, { data: person });
  } catch (error) {
    return jsonResponse(request, 502, {
      error: error instanceof Error ? error.message : 'No se pudo conectar con el proveedor de documentos.',
    });
  }
});
