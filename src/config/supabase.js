import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient(url, key) {
  return createClient(url, key);
}

export function createStoredClient() {
  const url = localStorage.getItem('sb_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem('sb_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return url && key ? createSupabaseClient(url, key) : null;
}
