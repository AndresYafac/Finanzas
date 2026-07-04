import { LOCKED_KEY, REMEMBER_EMAIL_KEY, REMEMBER_KEY } from '../constants/authStorage';

export async function signInWithPassword({ supabase, email, password, remember }) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error };

  if (remember) {
    localStorage.setItem(REMEMBER_KEY, '1');
    localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
    localStorage.removeItem(LOCKED_KEY);
  } else {
    clearRememberedAccount();
  }

  return { error: null };
}

export async function signUpUser({ supabase, email, password, nombre, apellido }) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre, apellido }, emailRedirectTo: window.location.origin },
  });
  return { error };
}

export function clearRememberedAccount() {
  localStorage.removeItem(REMEMBER_KEY);
  localStorage.removeItem(REMEMBER_EMAIL_KEY);
  localStorage.removeItem(LOCKED_KEY);
}
