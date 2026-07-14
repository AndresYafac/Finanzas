import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from 'https://esm.sh/@simplewebauthn/server@10.0.1';

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

function getExpectedOrigin(request: Request) {
  const configured = Deno.env.get('WEBAUTHN_ORIGIN') || '';
  return configured || request.headers.get('origin') || '';
}

function getRpId(request: Request) {
  const configured = Deno.env.get('WEBAUTHN_RP_ID') || '';
  if (configured) return configured;
  const origin = getExpectedOrigin(request);
  try {
    return new URL(origin).hostname;
  } catch {
    return 'localhost';
  }
}

function bufferToBase64Url(buffer: Uint8Array | ArrayBuffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToUint8Array(value: unknown) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value.map((item) => Number(item)));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const numericKeys = Object.keys(record)
      .filter((key) => /^\d+$/.test(key))
      .sort((a, b) => Number(a) - Number(b));
    if (numericKeys.length) return Uint8Array.from(numericKeys.map((key) => Number(record[key])));
  }

  const text = String(value || '');
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function textToUint8Array(value: string) {
  return new TextEncoder().encode(value);
}

function getSupabaseClients(request: Request) {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const authorization = request.headers.get('Authorization') || '';

  if (!url || !anonKey || !serviceKey) {
    throw new Error('Faltan variables internas de Supabase para WebAuthn.');
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

async function getCurrentUser(request: Request) {
  const { userClient, adminClient } = getSupabaseClients(request);
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    throw new Response(JSON.stringify({ error: 'Sesion no valida.' }), { status: 401 });
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id,nombre,apellido,email_contacto,activo,deleted_at')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile || profile.activo === false || profile.deleted_at) {
    throw new Response(JSON.stringify({ error: 'Usuario inactivo o no autorizado.' }), { status: 403 });
  }

  return { user: authData.user, profile, adminClient };
}

async function saveChallenge(adminClient: ReturnType<typeof createClient>, userId: string, type: string, challenge: string) {
  await adminClient.from('webauthn_challenges').delete().eq('user_id', userId).eq('type', type);
  const { error } = await adminClient.from('webauthn_challenges').insert({
    user_id: userId,
    type,
    challenge,
  });
  if (error) throw new Error(error.message);
}

async function getChallenge(adminClient: ReturnType<typeof createClient>, userId: string, type: string) {
  const { data, error } = await adminClient
    .from('webauthn_challenges')
    .select('id,challenge,expires_at')
    .eq('user_id', userId)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) throw new Error('Challenge WebAuthn no encontrado.');
  if (new Date(data.expires_at).getTime() < Date.now()) throw new Error('Challenge WebAuthn expirado.');
  return data;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, 405, { error: 'Metodo no permitido.' });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, 400, { error: 'Body JSON invalido.' });
  }

  try {
    const action = String(body.action || '');
    const { user, profile, adminClient } = await getCurrentUser(request);
    const expectedOrigin = getExpectedOrigin(request);
    const rpID = getRpId(request);

    if (action === 'registration-options') {
      const { data: existing } = await adminClient
        .from('webauthn_credentials')
        .select('credential_id')
        .eq('user_id', user.id);

      const options = await generateRegistrationOptions({
        rpName: 'FinTrack Pro',
        rpID,
        userID: textToUint8Array(user.id),
        userName: user.email || profile.email_contacto || user.id,
        userDisplayName: [profile.nombre, profile.apellido].filter(Boolean).join(' ') || user.email || 'FinTrack',
        attestationType: 'none',
        excludeCredentials: (existing || []).map((credential) => ({
          id: String(credential.credential_id || ''),
          type: 'public-key',
        })),
        authenticatorSelection: {
          residentKey: 'required',
          requireResidentKey: true,
          userVerification: 'required',
        },
      });

      await saveChallenge(adminClient, user.id, 'registration', options.challenge);
      return jsonResponse(request, 200, { data: options });
    }

    if (action === 'registration-verify') {
      const challenge = await getChallenge(adminClient, user.id, 'registration');
      const verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge: challenge.challenge,
        expectedOrigin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return jsonResponse(request, 400, { error: 'No se pudo verificar la credencial biometrica.' });
      }

      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
      const credentialId = bufferToBase64Url(credentialID);
      const publicKey = bufferToBase64Url(credentialPublicKey);
      const transports = Array.isArray((body.response as Record<string, unknown>)?.response?.transports)
        ? (body.response as { response?: { transports?: string[] } }).response?.transports || []
        : [];

      const { error } = await adminClient.from('webauthn_credentials').upsert({
        user_id: user.id,
        credential_id: credentialId,
        public_key: publicKey,
        counter,
        transports,
        device_name: String(body.deviceName || 'Este dispositivo').slice(0, 120),
      }, { onConflict: 'credential_id' });

      await adminClient.from('webauthn_challenges').delete().eq('id', challenge.id);
      if (error) return jsonResponse(request, 500, { error: error.message });
      return jsonResponse(request, 200, { data: { enabled: true } });
    }

    if (action === 'authentication-options') {
      const { data: credentials, error } = await adminClient
        .from('webauthn_credentials')
        .select('credential_id,transports')
        .eq('user_id', user.id);

      if (error) return jsonResponse(request, 500, { error: error.message });
      if (!credentials?.length) return jsonResponse(request, 404, { error: 'No tienes biometria activada en esta cuenta.' });

      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: 'required',
      });

      await saveChallenge(adminClient, user.id, 'authentication', options.challenge);
      return jsonResponse(request, 200, { data: options });
    }

    if (action === 'authentication-verify') {
      const credentialId = String((body.response as Record<string, unknown>)?.id || '');
      const { data: credential, error } = await adminClient
        .from('webauthn_credentials')
        .select('*')
        .eq('user_id', user.id)
        .eq('credential_id', credentialId)
        .maybeSingle();

      if (error || !credential) return jsonResponse(request, 404, { error: 'Credencial biometrica no encontrada.' });

      const challenge = await getChallenge(adminClient, user.id, 'authentication');
      const verification = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: challenge.challenge,
        expectedOrigin,
        expectedRPID: rpID,
        authenticator: {
          credentialID: base64UrlToUint8Array(credential.credential_id),
          credentialPublicKey: base64UrlToUint8Array(credential.public_key),
          counter: Number(credential.counter || 0),
          transports: credential.transports || undefined,
        },
        requireUserVerification: false,
      });

      await adminClient.from('webauthn_challenges').delete().eq('id', challenge.id);

      if (!verification.verified) {
        return jsonResponse(request, 400, { error: 'No se pudo validar la biometria.' });
      }

      await adminClient
        .from('webauthn_credentials')
        .update({
          counter: verification.authenticationInfo.newCounter,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', credential.id);

      return jsonResponse(request, 200, { data: { verified: true } });
    }

    return jsonResponse(request, 400, { error: 'Accion WebAuthn no valida.' });
  } catch (error) {
    if (error instanceof Response) {
      const text = await error.text();
      let payload: Record<string, unknown> = { error: text };
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text || 'Error WebAuthn.' };
      }
      return jsonResponse(request, error.status, payload);
    }

    return jsonResponse(request, 500, {
      error: error instanceof Error ? error.message : 'No se pudo procesar WebAuthn.',
    });
  }
});
