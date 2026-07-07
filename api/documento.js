const APISPERU_BASE_URL = 'https://dniruc.apisperu.com/api/v1';

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.end(JSON.stringify(payload));
}

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.end();
    return;
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Metodo no permitido.' });
    return;
  }

  const token = process.env.APISPERU_TOKEN || process.env.VITE_APISPERU_TOKEN || '';
  if (!token) {
    sendJson(response, 500, { error: 'Falta configurar APISPERU_TOKEN en Vercel.' });
    return;
  }

  const documento = String(request.query.documento || request.query.numero || '').trim();
  const rawTipo = String(request.query.tipo || '').trim().toLowerCase();
  const tipo = documento.length === 8 ? 'dni' : documento.length === 11 ? 'ruc' : rawTipo;

  if (!['dni', 'ruc'].includes(tipo)) {
    sendJson(response, 400, { error: 'Tipo de documento invalido. Usa DNI de 8 digitos o RUC de 11 digitos.' });
    return;
  }

  if ((tipo === 'dni' && !/^\d{8}$/.test(documento)) || (tipo === 'ruc' && !/^\d{11}$/.test(documento))) {
    sendJson(response, 400, { error: tipo === 'dni' ? 'El DNI debe tener 8 digitos.' : 'El RUC debe tener 11 digitos.' });
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
      sendJson(response, apiResponse.status, {
        error: payload?.message || payload?.error || `No se pudo consultar el documento (${apiResponse.status}).`,
      });
      return;
    }

    sendJson(response, 200, payload);
  } catch (error) {
    sendJson(response, 502, { error: error.message || 'No se pudo conectar con el proveedor de documentos.' });
  }
}
