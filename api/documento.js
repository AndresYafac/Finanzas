const APISPERU_BASE_URL = 'https://dniruc.apisperu.com/api/v1';

function resolveAllowedOrigin(request) {
  const origin = request.headers.origin || '';
  if (!origin) return '';

  const configuredOrigins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  try {
    const requestHost = request.headers.host || '';
    const originHost = new URL(origin).host;
    if (originHost === requestHost || configuredOrigins.includes(origin)) return origin;
  } catch {
    return '';
  }

  return '';
}

function sendJson(request, response, status, payload) {
  const allowedOrigin = resolveAllowedOrigin(request);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (allowedOrigin) {
    response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.end(JSON.stringify(payload));
}

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    const allowedOrigin = resolveAllowedOrigin(request);
    response.statusCode = 204;
    if (allowedOrigin) {
      response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      response.setHeader('Vary', 'Origin');
    }
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.end();
    return;
  }

  if (request.method !== 'GET') {
    sendJson(request, response, 405, { error: 'Metodo no permitido.' });
    return;
  }

  const token = process.env.APISPERU_TOKEN || '';
  if (!token) {
    sendJson(request, response, 500, { error: 'Falta configurar APISPERU_TOKEN en Vercel.' });
    return;
  }

  const documento = String(request.query.documento || request.query.numero || '').trim();
  const rawTipo = String(request.query.tipo || '').trim().toLowerCase();
  const tipo = documento.length === 8 ? 'dni' : documento.length === 11 ? 'ruc' : rawTipo;

  if (!['dni', 'ruc'].includes(tipo)) {
    sendJson(request, response, 400, { error: 'Tipo de documento invalido. Usa DNI de 8 digitos o RUC de 11 digitos.' });
    return;
  }

  if ((tipo === 'dni' && !/^\d{8}$/.test(documento)) || (tipo === 'ruc' && !/^\d{11}$/.test(documento))) {
    sendJson(request, response, 400, { error: tipo === 'dni' ? 'El DNI debe tener 8 digitos.' : 'El RUC debe tener 11 digitos.' });
    return;
  }

  try {
    const url = `${APISPERU_BASE_URL}/${tipo}/${encodeURIComponent(documento)}?token=${encodeURIComponent(token)}`;
    const apiResponse = await fetch(url, { headers: { accept: 'application/json' } });
    const text = await apiResponse.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { error: text || 'Respuesta invalida del proveedor.' };
    }

    if (!apiResponse.ok) {
      sendJson(request, response, apiResponse.status, {
        error: payload?.message || payload?.error || `No se pudo consultar el documento (${apiResponse.status}).`,
      });
      return;
    }

    sendJson(request, response, 200, payload);
  } catch (error) {
    sendJson(request, response, 502, { error: error.message || 'No se pudo conectar con el proveedor de documentos.' });
  }
}
