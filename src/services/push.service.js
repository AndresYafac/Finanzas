const DEFAULT_PREFERENCES = {
  enabled: false,
  debts_enabled: true,
  budgets_enabled: true,
  goals_enabled: true,
  low_balance_enabled: true,
  loans_enabled: true,
  reminder_hour: 9,
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function subscriptionToRecord(subscription, userId) {
  const json = subscription.toJSON();
  return {
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh || '',
    auth: json.keys?.auth || '',
    user_agent: navigator.userAgent,
    device_name: navigator.platform || 'Dispositivo',
    enabled: true,
    last_used_at: new Date().toISOString(),
  };
}

export function getVapidPublicKey() {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function getPushPreferences(supabase, userId) {
  const { data, error } = await supabase
    .from('push_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { data: DEFAULT_PREFERENCES, error };
  return { data: { ...DEFAULT_PREFERENCES, ...(data || {}) }, error: null };
}

export async function savePushPreferences(supabase, userId, preferences) {
  return supabase
    .from('push_preferences')
    .upsert({ user_id: userId, ...preferences }, { onConflict: 'user_id' })
    .select()
    .single();
}

export async function listPushDevices(supabase, userId) {
  return supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
}

export async function registerPushDevice(supabase, userId) {
  if (!isPushSupported()) {
    return { error: { message: 'Este navegador no soporta notificaciones push.' } };
  }

  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return { error: { message: 'Falta configurar VITE_VAPID_PUBLIC_KEY.' } };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { error: { message: 'Permiso de notificaciones denegado.' } };
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const record = subscriptionToRecord(subscription, userId);
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(record, { onConflict: 'endpoint' });

  if (error) return { error };
  const preferences = await savePushPreferences(supabase, userId, { ...DEFAULT_PREFERENCES, enabled: true });
  if (preferences.error) return { error: preferences.error };
  return { data: record, error: null };
}

export async function disablePushDevice(supabase, userId) {
  if (!isPushSupported()) return { error: null };
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await supabase
      .from('push_subscriptions')
      .update({ enabled: false })
      .eq('user_id', userId)
      .eq('endpoint', subscription.endpoint);
    await subscription.unsubscribe();
  }
  return savePushPreferences(supabase, userId, { enabled: false });
}

export async function sendTestPush(supabase) {
  const { data, error } = await supabase.functions.invoke('send-push', {
    body: {
      title: 'FinTrack Pro',
      body: 'Notificacion de prueba enviada correctamente.',
      url: '/',
      tag: 'fintrack-test',
    },
  });
  if (error) return { data: null, error };
  if (data?.error) return { data: null, error: { message: data.error } };
  return { data, error: null };
}
