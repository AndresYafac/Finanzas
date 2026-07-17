const USER_SETTINGS_TABLE = 'user_settings';

export async function getDashboardPreferences(supabase, userId) {
  if (!supabase || !userId) return { data: null, error: null };

  const { data, error } = await supabase
    .from(USER_SETTINGS_TABLE)
    .select('dashboard_cards,dashboard_charts')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { data: null, error };

  return {
    data: data
      ? {
          cards: data.dashboard_cards,
          charts: data.dashboard_charts,
        }
      : null,
    error: null,
  };
}

export async function saveDashboardPreferences(supabase, userId, preferences) {
  if (!supabase || !userId) return { error: null };

  const payload = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  if (preferences.cards !== undefined) payload.dashboard_cards = preferences.cards;
  if (preferences.charts !== undefined) payload.dashboard_charts = preferences.charts;

  const { error } = await supabase
    .from(USER_SETTINGS_TABLE)
    .upsert(payload, { onConflict: 'user_id' });

  return { error };
}
