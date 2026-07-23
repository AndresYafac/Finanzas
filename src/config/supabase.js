import { createClient } from '@supabase/supabase-js';

let cachedClient = null;
let cachedSignature = '';

export function createSupabaseClient(url, key) {
  const cleanUrl = String(url || '').trim().replace(/\/+$/, '');
  const cleanKey = String(key || '').trim();
  const signature = `${cleanUrl}|${cleanKey}`;
  if (cachedClient && cachedSignature === signature) {
    return cachedClient;
  }
  cachedSignature = signature;
  cachedClient = createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
  return cachedClient;
}

export function createStoredClient() {
  const url = localStorage.getItem('sb_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem('sb_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return url && key ? createSupabaseClient(url, key) : null;
}
