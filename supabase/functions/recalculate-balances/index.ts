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

function numberValue(value: unknown) {
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
    return jsonResponse(request, 401, { error: 'Sesion no valida.' });
  }

  const adminId = authData.user.id;
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id,activo,deleted_at')
    .eq('id', adminId)
    .single();

  if (profileError || !profile || profile.activo === false || profile.deleted_at) {
    return jsonResponse(request, 403, { error: 'Usuario inactivo o no autorizado.' });
  }

  const { data: accounts, error: accountsError } = await adminClient
    .from('cuentas')
    .select('id,banco,tipo,tipo_entidad,cuenta_vinculada_id,saldo,moneda')
    .eq('admin_id', adminId);

  if (accountsError) {
    return jsonResponse(request, 500, { error: accountsError.message });
  }

  const accountsById = new Map((accounts || []).map((account) => [account.id, account]));
  const wallets = (accounts || []).filter((account) => account.tipo_entidad === 'billetera' && account.cuenta_vinculada_id);
  const changes = [];

  for (const wallet of wallets) {
    const linked = accountsById.get(wallet.cuenta_vinculada_id);
    if (!linked) {
      changes.push({
        wallet_id: wallet.id,
        wallet: wallet.banco,
        status: 'missing_linked_account',
      });
      continue;
    }

    const walletSaldo = numberValue(wallet.saldo);
    const linkedSaldo = numberValue(linked.saldo);
    if (walletSaldo !== linkedSaldo || wallet.moneda !== linked.moneda) {
      const { error: updateError } = await adminClient
        .from('cuentas')
        .update({ saldo: linkedSaldo, moneda: linked.moneda })
        .eq('id', wallet.id)
        .eq('admin_id', adminId);

      if (updateError) {
        changes.push({
          wallet_id: wallet.id,
          wallet: wallet.banco,
          status: 'error',
          error: updateError.message,
        });
      } else {
        changes.push({
          wallet_id: wallet.id,
          wallet: wallet.banco,
          linked_account: linked.banco,
          previous_saldo: walletSaldo,
          new_saldo: linkedSaldo,
          previous_moneda: wallet.moneda,
          new_moneda: linked.moneda,
          status: 'synced',
        });
      }
    }
  }

  return jsonResponse(request, 200, {
    data: {
      checked_accounts: accounts?.length || 0,
      linked_wallets: wallets.length,
      changes,
      note: 'Se sincronizaron billeteras vinculadas con el saldo real de su banco. No se recalcula el saldo base historico porque el sistema no guarda un saldo inicial separado.',
    },
  });
});
