import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const ALLOWED_TABLES: Record<string, string[]> = {
  clientes: ['nombre', 'apellido', 'tipo_doc', 'documento', 'telefono', 'email', 'direccion', 'created_at'],
  cuentas: ['banco', 'tipo', 'tipo_entidad', 'numero', 'cci', 'moneda', 'saldo', 'created_at'],
  movimientos: ['fecha', 'tipo', 'concepto', 'tipo_movimiento', 'monto', 'created_at'],
  deudas: ['descripcion', 'monto_total', 'monto_pagado', 'interes', 'tipo', 'fecha_inicio', 'fecha_vencimiento', 'estado'],
  pagos: ['fecha', 'monto', 'metodo', 'referencia', 'notas', 'created_at'],
  prestamos_recibidos: ['acreedor', 'descripcion', 'monto_original', 'saldo_inicial', 'monto_pagado', 'interes', 'fecha_inicio', 'fecha_vencimiento'],
  pagos_prestamos_recibidos: ['fecha', 'monto', 'metodo', 'referencia', 'notas', 'created_at'],
  presupuestos: ['nombre', 'categoria', 'monto_limite', 'monto_usado', 'periodo', 'created_at'],
  metas: ['nombre', 'monto_objetivo', 'monto_actual', 'fecha_limite', 'estado', 'created_at'],
};

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

function csvEscape(value: unknown) {
  const text = value == null ? '' : String(value);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, 405, { error: 'Metodo no permitido.' });
  }

  let body: { table?: string; format?: string; limit?: unknown; filters?: Record<string, unknown>; columns?: string[] };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, 400, { error: 'Body JSON invalido.' });
  }

  const table = String(body.table || '').trim();
  if (!ALLOWED_TABLES[table]) {
    return jsonResponse(request, 400, { error: 'Tabla no permitida para exportacion.' });
  }

  const url = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const authorization = request.headers.get('Authorization') || '';

  if (!url || !anonKey) {
    return jsonResponse(request, 500, { error: 'Faltan variables internas de Supabase.' });
  }

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse(request, 401, { error: 'Sesion no valida.' });
  }

  const allowedColumns = ALLOWED_TABLES[table];
  const columns = (Array.isArray(body.columns) ? body.columns : allowedColumns)
    .filter((column) => allowedColumns.includes(column));

  if (!columns.length) {
    return jsonResponse(request, 400, { error: 'No hay columnas validas para exportar.' });
  }

  let query = supabase
    .from(table)
    .select(columns.join(','))
    .eq('admin_id', authData.user.id)
    .limit(Math.min(Math.max(Number(body.limit || 1000), 1), 5000));

  const filters = body.filters || {};
  for (const [field, value] of Object.entries(filters)) {
    if (allowedColumns.includes(field) && value !== '' && value != null) {
      query = query.ilike(field, `%${String(value)}%`);
    }
  }

  const { data, error } = await query;
  if (error) {
    return jsonResponse(request, 500, { error: error.message });
  }

  if (String(body.format || 'json').toLowerCase() === 'csv') {
    const rows = data || [];
    const csv = [
      columns.map(csvEscape).join(';'),
      ...rows.map((row) => columns.map((column) => csvEscape((row as Record<string, unknown>)[column])).join(';')),
    ].join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        ...getCorsHeaders(request),
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${table}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return jsonResponse(request, 200, {
    data: {
      table,
      columns,
      rows: data || [],
      count: data?.length || 0,
    },
  });
});
