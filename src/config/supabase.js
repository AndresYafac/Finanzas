import { createClient } from '@supabase/supabase-js';
import { hideBusy, showBusy } from '../services/feedback';

export function createSupabaseClient(url, key) {
  return createClient(url, key, {
    global: {
      fetch: async (...args) => {
        showBusy('Procesando...');
        try {
          return await fetch(...args);
        } finally {
          hideBusy();
        }
      },
    },
  });
}

export function createStoredClient() {
  const url = localStorage.getItem('sb_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem('sb_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return url && key ? createSupabaseClient(url, key) : null;
}
