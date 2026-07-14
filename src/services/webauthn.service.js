function browserSupportsWebAuthn() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
}

function base64UrlToBuffer(value) {
  const base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value || '').length / 4) * 4, '=');
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

function textToBuffer(value) {
  return new TextEncoder().encode(String(value || '')).buffer;
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
      id: textToBuffer(options.user.id),
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
  const { data, error } = await supabase.functions.invoke('webauthn', { body });
  if (error) return { data: null, error };
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
    return { error: { message: error?.message || 'Validacion biometrica cancelada.' } };
  }
}
