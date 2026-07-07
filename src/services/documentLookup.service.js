function fillTemplate(template, params) {
  return template
    .replaceAll('{tipo}', encodeURIComponent(params.tipo))
    .replaceAll('{documento}', encodeURIComponent(params.documento))
    .replaceAll('{numero}', encodeURIComponent(params.documento));
}

function resolveLookupUrl(tipo, documento) {
  const normalizedDoc = String(documento || '').trim();
  const inferredType = normalizedDoc.length === 8 ? 'dni' : normalizedDoc.length === 11 ? 'ruc' : String(tipo || '').toLowerCase();
  const template = import.meta.env.VITE_DOCUMENT_LOOKUP_URL || '';
  if (template) return fillTemplate(template, { tipo: inferredType, documento: normalizedDoc });
  if (import.meta.env.PROD) {
    return `/api/documento?tipo=${encodeURIComponent(inferredType)}&documento=${encodeURIComponent(normalizedDoc)}`;
  }
  const apiPeruToken = import.meta.env.VITE_APISPERU_TOKEN || '';
  if (apiPeruToken && ['dni', 'ruc'].includes(inferredType)) {
    return `https://dniruc.apisperu.com/api/v1/${inferredType}/${encodeURIComponent(normalizedDoc)}?token=${encodeURIComponent(apiPeruToken)}`;
  }
  return '';
}

function normalizePerson(data) {
  const source = Array.isArray(data) ? data[0] : data;
  if (!source || typeof source !== 'object') return null;
  const razonSocial = source.razonSocial || source.razon_social || '';
  const nombres = source.nombres || source.nombre || source.nombre_completo || '';
  const apellido = [source.apellidoPaterno, source.apellido_paterno, source.apellidoMaterno, source.apellido_materno]
    .filter(Boolean)
    .join(' ');
  return {
    nombre: razonSocial || nombres,
    apellido: razonSocial ? '' : apellido,
    direccion: source.direccion || source.address || '',
  };
}

export async function lookupDocument({ tipo, documento }) {
  const url = resolveLookupUrl(tipo, documento);
  if (!url) {
    return { error: 'Configura APISPERU_TOKEN en Vercel o VITE_APISPERU_TOKEN en local para habilitar la busqueda de documentos.' };
  }
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) return { error: `No se pudo consultar el documento (${response.status}).` };
    const data = await response.json();
    const person = normalizePerson(data);
    if (!person?.nombre) return { error: 'La API no devolvio datos reconocibles.' };
    return { data: person };
  } catch (error) {
    return { error: error.message || 'No se pudo consultar el documento.' };
  }
}
