import { LOCKED_KEY, REMEMBER_EMAIL_KEY, REMEMBER_KEY } from '../constants/authStorage';
import { storage } from '../services/storage.service';
import { isNativeApp } from '../services/platform.service';

const LOGIN_ATTEMPTS_KEY = 'fintrack_login_attempts';
const LOGIN_LOCK_UNTIL_KEY = 'fintrack_login_locked_until';

function normalizeEmail(email = '') {
  return email.trim().toLowerCase();
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

export function friendlyAuthError(error) {
  const message = error?.message || '';
  if (/email not confirmed/i.test(message)) return 'Debes confirmar tu correo antes de ingresar.';
  if (/rate limit|too many|429/i.test(message)) return 'Demasiados intentos. Espera unos minutos antes de volver a intentar.';
  if (/invalid login credentials|invalid credentials/i.test(message)) return 'Correo o contraseña incorrectos, o la cuenta ya no existe.';
  if (/network|fetch/i.test(message)) return 'No se pudo conectar. Revisa tu conexión a internet.';
  return message || 'No se pudo completar la autenticación.';
}

export async function signInWithPassword({ supabase, email, password, remember }) {
  const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
  if (error) {
    const rememberedEmail = storage.getRaw(REMEMBER_EMAIL_KEY);
    const isInvalidCredentials = /invalid login credentials|invalid credentials/i.test(error.message || '');
    const shouldClearRemembered = rememberedEmail === normalizeEmail(email) && isInvalidCredentials;
    if (shouldClearRemembered) {
      clearRememberedAccount();
    }
    clearLoginState(email);
    return { error: { message: friendlyAuthError(error), clearRemembered: shouldClearRemembered } };
  }
  clearLoginState(email);

  const shouldRemember = remember || isNativeApp();

  if (shouldRemember) {
    storage.setRaw(REMEMBER_KEY, '1');
    storage.setRaw(REMEMBER_EMAIL_KEY, normalizeEmail(email));
    storage.remove(LOCKED_KEY);
  } else {
    clearRememberedAccount();
  }

  return { error: null };
}

export async function signUpUser({ supabase, email, password, nombre, apellido }) {
  const { error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: { data: { nombre, apellido }, emailRedirectTo: getAuthRedirectUrl() },
  });
  return { error };
}

export async function sendPasswordReset({ supabase, email }) {
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: getAuthRedirectUrl('?recovery=1'),
  });
  return { error };
}

export function clearRememberedAccount() {
  storage.remove(REMEMBER_KEY);
  storage.remove(REMEMBER_EMAIL_KEY);
  storage.remove(LOCKED_KEY);
}
