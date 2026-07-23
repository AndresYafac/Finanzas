import { LOCKED_KEY, REMEMBER_EMAIL_KEY, REMEMBER_KEY } from '../constants/authStorage';
import { storage } from '../services/storage.service';
import { isNativeApp } from '../services/platform.service';

const LOGIN_ATTEMPTS_KEY = 'fintrack_login_attempts';
const LOGIN_LOCK_UNTIL_KEY = 'fintrack_login_locked_until';
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 5 * 60 * 1000;
const ACCOUNT_UNAVAILABLE_MESSAGE = 'La cuenta no existe, fue eliminada o esta desactivada. Contacta al administrador.';

function normalizeEmail(email = '') {
  return email.trim().toLowerCase();
}

function getLoginState(email) {
  const normalized = normalizeEmail(email);
  const attempts = storage.getJson(LOGIN_ATTEMPTS_KEY, {});
  const locks = storage.getJson(LOGIN_LOCK_UNTIL_KEY, {});
  return {
    normalized,
    attempts,
    locks,
    count: Number(attempts[normalized] || 0),
    lockedUntil: Number(locks[normalized] || 0),
  };
}

function getActiveLock(email) {
  const state = getLoginState(email);
  if (state.lockedUntil > Date.now()) return state.lockedUntil;
  if (state.lockedUntil) {
    delete state.locks[state.normalized];
    storage.setJson(LOGIN_LOCK_UNTIL_KEY, state.locks);
  }
  return 0;
}

function recordLoginFailure(email) {
  const state = getLoginState(email);
  const nextCount = state.count + 1;
  state.attempts[state.normalized] = nextCount;

  let lockedUntil = 0;
  if (nextCount >= MAX_LOGIN_ATTEMPTS) {
    lockedUntil = Date.now() + LOGIN_LOCK_MS;
    state.locks[state.normalized] = lockedUntil;
    state.attempts[state.normalized] = 0;
  }

  storage.setJson(LOGIN_ATTEMPTS_KEY, state.attempts);
  storage.setJson(LOGIN_LOCK_UNTIL_KEY, state.locks);

  return {
    lockedUntil,
    remaining: lockedUntil ? 0 : Math.max(MAX_LOGIN_ATTEMPTS - nextCount, 0),
  };
}

function formatLockMessage(lockedUntil) {
  const seconds = Math.max(Math.ceil((lockedUntil - Date.now()) / 1000), 1);
  const minutes = Math.ceil(seconds / 60);
  return `Demasiados intentos fallidos. Intenta nuevamente en ${minutes} min.`;
}

export function getAuthRedirectUrl(path = '') {
  const suffix = path ? String(path) : '';
  if (isNativeApp()) return `com.fintrack.pro://auth/callback${suffix}`;
  return `${window.location.origin}${suffix}`;
}

function clearLoginState(email) {
  const normalized = normalizeEmail(email);
  const state = storage.getJson(LOGIN_ATTEMPTS_KEY, {});
  const locks = storage.getJson(LOGIN_LOCK_UNTIL_KEY, {});
  delete state[normalized];
  delete locks[normalized];
  storage.setJson(LOGIN_ATTEMPTS_KEY, state);
  storage.setJson(LOGIN_LOCK_UNTIL_KEY, locks);
}

function shouldClearRememberedAccount(email) {
  return storage.getRaw(REMEMBER_EMAIL_KEY) === normalizeEmail(email);
}

function clearUnavailableAccountState(email) {
  clearLoginState(email);
  if (shouldClearRememberedAccount(email)) {
    clearRememberedAccount();
  }
}

async function isEmailAvailableForLogin({ supabase, email }) {
  const emailCheck = await checkEmailRegistered({ supabase, email });
  if (emailCheck.error) return { available: true, error: emailCheck.error };
  return { available: emailCheck.exists, error: null };
}

async function validateAuthenticatedProfile({ supabase, userId }) {
  if (!userId) return { available: false, error: null };

  const { data, error } = await supabase
    .from('profiles')
    .select('id,activo,deleted_at')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data || data.activo === false || data.deleted_at) {
    return { available: false, error };
  }

  return { available: true, error: null };
}

export function friendlyAuthError(error) {
  const message = error?.message || '';
  if (/account_not_available|cuenta no existe|fue eliminada|desactivada/i.test(message)) return ACCOUNT_UNAVAILABLE_MESSAGE;
  if (/correo ya est[aá] registrado|email.*registered|user already registered|already registered|email_exists/i.test(message)) return 'Este correo ya está registrado. Inicia sesión o usa recuperar contraseña.';
  if (/email not confirmed/i.test(message)) return 'Debes confirmar tu correo antes de ingresar.';
  if (/rate limit|too many|429/i.test(message)) return 'Demasiados intentos. Espera unos minutos antes de volver a intentar.';
  if (/invalid login credentials|invalid credentials/i.test(message)) return 'Correo o contraseña incorrectos, o la cuenta ya no existe.';
  if (/network|fetch/i.test(message)) return 'No se pudo conectar. Revisa tu conexión a internet.';
  return message || 'No se pudo completar la autenticación.';
}

export async function checkEmailRegistered({ supabase, email }) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { exists: false, error: null };

  const { data, error } = await supabase.rpc('auth_email_exists', { p_email: normalized });
  if (error) return { exists: false, error };

  return { exists: Boolean(data), error: null };
}

export async function signInWithPassword({ supabase, email, password, remember, captchaToken }) {
  const normalizedEmail = normalizeEmail(email);

  const emailAvailability = await isEmailAvailableForLogin({ supabase, email: normalizedEmail });
  if (!emailAvailability.available) {
    clearUnavailableAccountState(normalizedEmail);
    return { error: { code: 'account_not_available', message: ACCOUNT_UNAVAILABLE_MESSAGE, clearRemembered: true } };
  }

  const lockedUntil = getActiveLock(normalizedEmail);
  if (lockedUntil) {
    return { error: { code: 'login_locked', message: formatLockMessage(lockedUntil) } };
  }

  const payload = { email: normalizedEmail, password };
  if (captchaToken) payload.options = { captchaToken };

  const { data, error } = await supabase.auth.signInWithPassword(payload);
  if (error) {
    const isInvalidCredentials = /invalid login credentials|invalid credentials/i.test(error.message || '');
    const shouldClearRemembered = shouldClearRememberedAccount(normalizedEmail) && isInvalidCredentials;
    if (shouldClearRemembered) {
      clearRememberedAccount();
    }

    if (isInvalidCredentials) {
      const failure = recordLoginFailure(normalizedEmail);
      const message = failure.lockedUntil
        ? formatLockMessage(failure.lockedUntil)
        : `Correo o contraseña incorrectos. Intentos restantes: ${failure.remaining}.`;
      return { error: { message, clearRemembered: shouldClearRemembered } };
    }

    return { error: { message: friendlyAuthError(error), clearRemembered: shouldClearRemembered } };
  }

  const profileAvailability = await validateAuthenticatedProfile({ supabase, userId: data?.user?.id });
  if (!profileAvailability.available) {
    await supabase.auth.signOut();
    clearUnavailableAccountState(normalizedEmail);
    return { error: { code: 'account_not_available', message: ACCOUNT_UNAVAILABLE_MESSAGE, clearRemembered: true } };
  }

  clearLoginState(normalizedEmail);

  const shouldRemember = remember || isNativeApp();

  if (shouldRemember) {
    storage.setRaw(REMEMBER_KEY, '1');
    storage.setRaw(REMEMBER_EMAIL_KEY, normalizedEmail);
    storage.remove(LOCKED_KEY);
  } else {
    clearRememberedAccount();
  }

  return { error: null, user: data?.user || null };
}

export async function signUpUser({ supabase, email, password, nombre, apellido, captchaToken }) {
  const normalizedEmail = normalizeEmail(email);
  const emailCheck = await checkEmailRegistered({ supabase, email: normalizedEmail });

  if (emailCheck.exists) {
    return { error: { code: 'email_exists', message: 'Este correo ya está registrado.' } };
  }

  const options = { data: { nombre, apellido }, emailRedirectTo: getAuthRedirectUrl() };
  if (captchaToken) options.captchaToken = captchaToken;

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options,
  });

  if (!error && data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: { code: 'email_exists', message: 'Este correo ya está registrado.' } };
  }

  return { error, user: data?.user || null };
}

export async function sendPasswordReset({ supabase, email, captchaToken }) {
  const options = { redirectTo: getAuthRedirectUrl('?recovery=1') };
  if (captchaToken) options.captchaToken = captchaToken;

  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), options);
  return { error };
}

export function clearRememberedAccount() {
  storage.remove(REMEMBER_KEY);
  storage.remove(REMEMBER_EMAIL_KEY);
  storage.remove(LOCKED_KEY);
}
