import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

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

  if (!url || !anonKey || !serviceKey) throw new Error('Faltan variables internas de Supabase.');

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

function base64UrlEncode(value: string | ArrayBuffer) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function getFirebaseAccessToken(credentials: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64UrlEncode(JSON.stringify({
    iss: credentials.client_email,
    scope: FCM_SCOPE,
    aud: OAUTH_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const unsignedJwt = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(credentials.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsignedJwt));
  const jwt = `${unsignedJwt}.${base64UrlEncode(signature)}`;
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || 'No se pudo autenticar con Firebase.');
  return data.access_token as string;
}

function getFirebaseCredentials() {
  const encoded = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_BASE64') || '';
  const raw = encoded
    ? new TextDecoder().decode(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)))
    : (Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || '');
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
    if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
      throw new Error('El JSON de Firebase no contiene project_id, client_email o private_key.');
    }
    return credentials as { project_id: string; client_email: string; private_key: string };
  } catch (error) {
    throw new Error(`Credenciales Firebase invalidas. Configura FIREBASE_SERVICE_ACCOUNT_BASE64 nuevamente. ${error instanceof Error ? error.message : ''}`);
  }
}

async function sendFcmNotification(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  body: {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
    type?: string;
  },
) {
  const credentials = getFirebaseCredentials();
  if (!credentials) return { sent: 0, failed: 0, skipped: 'firebase_not_configured' };

  const { data: devices, error } = await adminClient
    .from('mobile_push_devices')
    .select('id,token')
    .eq('user_id', userId)
    .eq('enabled', true);

  if (error) throw error;
  if (!devices?.length) return { sent: 0, failed: 0 };

  const accessToken = await getFirebaseAccessToken(credentials);
  let sent = 0;
  let failed = 0;

  for (const device of devices) {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${credentials.project_id}/messages:send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: device.token,
          notification: {
            title: body.title || 'FinTrack Pro',
            body: body.body || 'Tienes una nueva alerta.',
          },
          data: {
            url: body.url || '/?page=notificaciones',
            tag: body.tag || 'fintrack-alert',
            type: body.type || 'alert',
          },
          android: {
            priority: 'HIGH',
            notification: {
              channel_id: 'fintrack_alerts',
              sound: 'default',
            },
          },
        },
      }),
    });

    if (response.ok) {
      sent += 1;
      await adminClient.from('mobile_push_devices').update({ last_used_at: new Date().toISOString() }).eq('id', device.id);
      continue;
    }

    failed += 1;
    const data = await response.json().catch(() => ({}));
    const errorCode = data?.error?.details?.[0]?.errorCode || data?.error?.status || '';
    if (['UNREGISTERED', 'INVALID_ARGUMENT', 'NOT_FOUND'].includes(errorCode)) {
      await adminClient.from('mobile_push_devices').update({ enabled: false }).eq('id', device.id);
    }
  }

  return { sent, failed };
}

async function sendWebPushFallback(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  body: {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
    type?: string;
    requireInteraction?: boolean;
  },
) {
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@fintrack.local';

  if (!vapidPublicKey || !vapidPrivateKey) return { sent: 0, failed: 0, skipped: 'web_push_not_configured' };

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const { data: subscriptions, error } = await adminClient
    .from('push_subscriptions')
    .select('id,endpoint,p256dh,auth,enabled')
    .eq('user_id', userId)
    .eq('enabled', true);

  if (error) throw error;

  const payload = JSON.stringify({
    title: body.title || 'FinTrack Pro',
    body: body.body || 'Tienes una nueva alerta.',
    url: body.url || '/',
    tag: body.tag || 'fintrack-alert',
    type: body.type || 'alert',
    requireInteraction: !!body.requireInteraction,
  });

  let sent = 0;
  let failed = 0;

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
      failed += 1;
      const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
      if ([404, 410].includes(statusCode)) {
        await adminClient.from('push_subscriptions').update({ enabled: false }).eq('id', subscription.id);
      }
    }
  }

  return { sent, failed };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, 405, { error: 'Metodo no permitido.' });

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
    if (authError || !authData.user) return jsonResponse(request, 401, { error: 'Sesion no valida.' });

    const userId = authData.user.id;
    const { data: preferences } = await adminClient
      .from('push_preferences')
      .select('enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (preferences?.enabled === false) {
      return jsonResponse(request, 200, { sent: 0, skipped: true, reason: 'Preferencias desactivadas.' });
    }

    const fcm = await sendFcmNotification(adminClient, userId, body);
    if (fcm.sent || fcm.failed || fcm.skipped !== 'firebase_not_configured') {
      return jsonResponse(request, 200, { channel: 'fcm', ...fcm });
    }

    const web = await sendWebPushFallback(adminClient, userId, body);
    return jsonResponse(request, 200, { channel: 'web-push', ...web });
  } catch (error) {
    return jsonResponse(request, 500, { error: error instanceof Error ? error.message : 'No se pudo enviar la notificacion.' });
  }
});
