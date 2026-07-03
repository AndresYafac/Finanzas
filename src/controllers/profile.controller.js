import { hashPin, randomHex } from '../utils/security';

export async function updateProfile({ supabase, userId, form }) {
  const payload = { ...form, updated_at: new Date().toISOString() };
  const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
  return { error };
}

export async function updateMobilePin({ supabase, userId, pin }) {
  const salt = randomHex(16);
  const pin_hash = await hashPin(pin, salt);
  const { error } = await supabase.from('profiles').update({
    pin_hash,
    pin_salt: salt,
    pin_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', userId);

  return { error };
}
