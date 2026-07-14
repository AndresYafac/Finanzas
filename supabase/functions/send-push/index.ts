import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

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

function createClients(request: Request) {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const authorization = request.headers.get('Authorization') || '';

  if (!url || !anonKey || !serviceKey) {
    throw new Error('Faltan variables internas de Supabase.');
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

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@fintrack.local';

  if (!vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse(request, 500, { error: 'Faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en Supabase secrets.' });
  }

  let body: {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
    type?: string;
    requireInteraction?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, 400, { error: 'Body JSON invalido.' });
  }

  try {
    const { userClient, adminClient } = createClients(request);
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse(request, 401, { error: 'Sesion no valida.' });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const userId = authData.user.id;
    const { data: preferences } = await adminClient
      .from('push_preferences')
      .select('enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (preferences?.enabled === false) {
      return jsonResponse(request, 200, { sent: 0, skipped: true, reason: 'Preferencias desactivadas.' });
    }

    const { data: subscriptions, error: subscriptionsError } = await adminClient
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth,enabled')
      .eq('user_id', userId)
      .eq('enabled', true);

    if (subscriptionsError) {
      return jsonResponse(request, 500, { error: subscriptionsError.message });
    }

    const payload = JSON.stringify({
      title: body.title || 'FinTrack Pro',
      body: body.body || 'Tienes una nueva alerta.',
      url: body.url || '/',
      tag: body.tag || 'fintrack-alert',
      type: body.type || 'alert',
      requireInteraction: !!body.requireInteraction,
    });

    let sent = 0;
    const failed: string[] = [];

    for (const subscription of subscriptions || []) {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        }, payload);
        sent += 1;
        await adminClient.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', subscription.id);
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
        if ([404, 410].includes(statusCode)) {
          await adminClient.from('push_subscriptions').update({ enabled: false }).eq('id', subscription.id);
        }
        failed.push(subscription.id);
      }
    }

    return jsonResponse(request, 200, { sent, failed: failed.length });
  } catch (error) {
    return jsonResponse(request, 500, { error: error instanceof Error ? error.message : 'No se pudo enviar la notificacion.' });
  }
});
