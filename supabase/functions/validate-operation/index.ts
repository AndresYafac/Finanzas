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

function money(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, 405, { error: 'Metodo no permitido.' });
  }

  let body: {
    operation?: string;
    tipo?: string;
    monto?: unknown;
    cuenta_id?: string;
    cuenta_origen_id?: string;
    cuenta_destino_id?: string;
    deuda_id?: string;
    prestamo_recibido_id?: string;
  };

  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, 400, { error: 'Body JSON invalido.' });
  }

  const amount = money(body.monto);
  if (amount <= 0) {
    return jsonResponse(request, 400, { ok: false, error: 'El monto debe ser mayor a cero.' });
  }

  const url = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const authorization = request.headers.get('Authorization') || '';

  if (!url || !anonKey || !serviceKey) {
    return jsonResponse(request, 500, { error: 'Faltan variables internas de Supabase.' });
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse(request, 401, { ok: false, error: 'Sesion no valida.' });
  }

  const adminId = authData.user.id;
  const operation = String(body.operation || '').toLowerCase();

  async function getOperationalAccount(accountId: string | undefined) {
    if (!accountId) return null;
    const { data: account, error } = await adminClient
      .from('cuentas')
      .select('id,banco,tipo,saldo,tipo_entidad,cuenta_vinculada_id')
      .eq('id', accountId)
      .eq('admin_id', adminId)
      .maybeSingle();

    if (error || !account) return null;
    if (!account.cuenta_vinculada_id) return account;

    const { data: linked } = await adminClient
      .from('cuentas')
      .select('id,banco,tipo,saldo,tipo_entidad,cuenta_vinculada_id')
      .eq('id', account.cuenta_vinculada_id)
      .eq('admin_id', adminId)
      .maybeSingle();

    return linked || account;
  }

  if (['egreso', 'transferencia', 'pago_prestamo_recibido', 'prestamo_otorgado'].includes(operation)) {
    const accountId = body.cuenta_id || body.cuenta_origen_id;
    const account = await getOperationalAccount(accountId);
    if (!account) {
      return jsonResponse(request, 404, { ok: false, error: 'Cuenta no encontrada.' });
    }

    if (money(account.saldo) < amount) {
      return jsonResponse(request, 409, {
        ok: false,
        error: `Saldo insuficiente en ${account.banco}. Disponible: ${money(account.saldo).toFixed(2)}.`,
      });
    }
  }

  if (operation === 'pago_deuda' && body.deuda_id) {
    const { data: deuda } = await adminClient
      .from('deudas')
      .select('id,monto_total,monto_pagado')
      .eq('id', body.deuda_id)
      .eq('admin_id', adminId)
      .maybeSingle();

    if (!deuda) return jsonResponse(request, 404, { ok: false, error: 'Cuenta por cobrar no encontrada.' });
    const pending = money(deuda.monto_total) - money(deuda.monto_pagado);
    if (amount > pending) {
      return jsonResponse(request, 409, { ok: false, error: `El cobro supera el saldo pendiente (${pending.toFixed(2)}).` });
    }
  }

  if (operation === 'pago_prestamo_recibido' && body.prestamo_recibido_id) {
    const { data: prestamo } = await adminClient
      .from('prestamos_recibidos')
      .select('id,saldo_inicial,monto_pagado')
      .eq('id', body.prestamo_recibido_id)
      .eq('admin_id', adminId)
      .maybeSingle();

    if (!prestamo) return jsonResponse(request, 404, { ok: false, error: 'Prestamo por pagar no encontrado.' });
    const pending = money(prestamo.saldo_inicial) - money(prestamo.monto_pagado);
    if (amount > pending) {
      return jsonResponse(request, 409, { ok: false, error: `El pago supera el saldo pendiente (${pending.toFixed(2)}).` });
    }
  }

  return jsonResponse(request, 200, { ok: true, data: { operation, amount } });
});
