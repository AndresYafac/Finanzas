function browserSupportsWebAuthn() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
}

function bytesLikeToBuffer(value) {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  if (Array.isArray(value)) return new Uint8Array(value).buffer;
  if (value && typeof value === 'object') {
    const numericKeys = Object.keys(value).filter((key) => /^\d+$/.test(key)).sort((a, b) => Number(a) - Number(b));
    if (numericKeys.length) return new Uint8Array(numericKeys.map((key) => Number(value[key]))).buffer;
  }
  return null;
}

function base64UrlToBuffer(value) {
  const bytesBuffer = bytesLikeToBuffer(value);
  if (bytesBuffer) return bytesBuffer;

  const text = String(value || '');
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function serializeCredential(credential) {
  const response = credential.response;
  const payload = {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {},
    clientExtensionResults: credential.getClientExtensionResults?.() || {},
  };

  if (response.attestationObject) payload.response.attestationObject = bufferToBase64Url(response.attestationObject);
  if (response.authenticatorData) payload.response.authenticatorData = bufferToBase64Url(response.authenticatorData);
  if (response.clientDataJSON) payload.response.clientDataJSON = bufferToBase64Url(response.clientDataJSON);
  if (response.signature) payload.response.signature = bufferToBase64Url(response.signature);
  if (response.userHandle) payload.response.userHandle = bufferToBase64Url(response.userHandle);
  if (typeof response.getTransports === 'function') payload.response.transports = response.getTransports();

  return payload;
}

function prepareRegistrationOptions(options) {
  return {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64UrlToBuffer(options.user.id),
    },
    excludeCredentials: (options.excludeCredentials || []).map((credential) => ({
      ...credential,
      id: base64UrlToBuffer(credential.id),
    })),
  };
}

function prepareAuthenticationOptions(options) {
  return {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((credential) => ({
      ...credential,
      id: base64UrlToBuffer(credential.id),
    })),
  };
}

async function invokeWebAuthn(supabase, body) {
  const sessionResult = await supabase.auth.getSession();
  let currentSession = sessionResult.data?.session || null;
  if (!currentSession) {
    return {
      data: null,
      error: {
        code: 'SESSION_REQUIRED',
        message: 'Tu sesion ya no esta activa. Inicia sesion nuevamente con correo y contrasena.',
      },
    };
  }

  const expiresAt = Number(currentSession.expires_at || 0) * 1000;
  if (expiresAt && expiresAt - Date.now() < 60_000) {
    const refreshResult = await supabase.auth.refreshSession();
    currentSession = refreshResult.data?.session || null;
    if (refreshResult.error || !currentSession) {
      return {
        data: null,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Tu sesion recordada vencio. Ingresa nuevamente con correo y contrasena.',
        },
      };
    }
  }

  const { data, error } = await supabase.functions.invoke('webauthn', { body });
  if (error) {
    let message = error.message || 'No se pudo ejecutar WebAuthn.';
    try {
      const payload = typeof error.context?.json === 'function' ? await error.context.json() : null;
      message = payload?.error || payload?.message || message;
    } catch {
      try {
        const text = typeof error.context?.text === 'function' ? await error.context.text() : '';
        if (text) message = text;
      } catch {
        // Keep the original Supabase error message.
      }
    }
    if (/sesion no valida|session.*invalid|jwt|unauthorized/i.test(message)) {
      const refreshResult = await supabase.auth.refreshSession();
      if (refreshResult.data?.session && !refreshResult.error) {
        const retry = await supabase.functions.invoke('webauthn', { body });
        if (!retry.error) {
          if (retry.data?.error) return { data: null, error: { message: retry.data.error } };
          return { data: retry.data?.data, error: null };
        }
      }
      message = 'Tu sesion recordada vencio. Ingresa nuevamente con correo y contrasena.';
    }
    return { data: null, error: { ...error, message } };
  }
  if (data?.error) return { data: null, error: { message: data.error } };
  return { data: data?.data, error: null };
}

export function isWebAuthnSupported() {
  return browserSupportsWebAuthn() && window.isSecureContext;
}

export async function registerPasskey(supabase) {
  if (!isWebAuthnSupported()) {
    return { error: { message: 'Este navegador o conexion no soporta Passkeys. Usa HTTPS o localhost.' } };
  }

  const optionsResult = await invokeWebAuthn(supabase, { action: 'registration-options' });
  if (optionsResult.error) return optionsResult;

  try {
    const credential = await navigator.credentials.create({
      publicKey: prepareRegistrationOptions(optionsResult.data),
    });
    if (!credential) return { error: { message: 'No se creo la credencial biometrica.' } };

    return invokeWebAuthn(supabase, {
      action: 'registration-verify',
      response: serializeCredential(credential),
      deviceName: navigator.userAgent,
    });
  } catch (error) {
    return { error: { message: error?.message || 'Registro biometrico cancelado.' } };
  }
}

export async function authenticateWithPasskey(supabase) {
  if (!isWebAuthnSupported()) {
    return { error: { message: 'Este navegador o conexion no soporta Passkeys. Usa HTTPS o localhost.' } };
  }

  const optionsResult = await invokeWebAuthn(supabase, { action: 'authentication-options' });
  if (optionsResult.error) return optionsResult;

  try {
    const credential = await navigator.credentials.get({
      publicKey: prepareAuthenticationOptions(optionsResult.data),
    });
    if (!credential) return { error: { message: 'No se obtuvo la credencial biometrica.' } };

    return invokeWebAuthn(supabase, {
      action: 'authentication-verify',
      response: serializeCredential(credential),
    });
  } catch (error) {
    const message = String(error?.message || '');
    if (/no hay llaves|no credentials|notallowed|not allowed|not found|cancel/i.test(message)) {
      return {
        error: {
          code: 'PASSKEY_NOT_FOUND',
          message: 'No hay una llave de acceso para este dispositivo. Activa la biometria nuevamente desde Seguridad en este mismo celular.',
        },
      };
    }
    return { error: { message: message || 'Validacion biometrica cancelada.' } };
  }
}
