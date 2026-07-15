import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const DEFAULT_PREFERENCES = {
  enabled: false,
  debts_enabled: true,
  budgets_enabled: true,
  goals_enabled: true,
  low_balance_enabled: true,
  loans_enabled: true,
  reminder_hour: 9,
};

function getDeviceName() {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return 'Android';
  if (platform === 'ios') return 'iOS';
  return navigator.platform || 'Dispositivo';
}

function buildNativeRecord(token, userId) {
  return {
    user_id: userId,
    token,
    provider: 'fcm',
    platform: Capacitor.getPlatform(),
    user_agent: navigator.userAgent,
    device_name: getDeviceName(),
    enabled: true,
    last_used_at: new Date().toISOString(),
  };
}

export function getVapidPublicKey() {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
}

export function isNativePushSupported() {
  return Capacitor.isNativePlatform() && ['android', 'ios'].includes(Capacitor.getPlatform());
}

export function isPushSupported() {
  return isNativePushSupported();
}

export function getNotificationPermission() {
  if (!isNativePushSupported()) return 'solo app movil';
  return 'segun dispositivo';
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
  const result = await supabase
    .from('mobile_push_devices')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (result.error?.code === '42P01') {
    return { data: [], error: null };
  }

  return result;
}

export async function registerPushDevice(supabase, userId) {
  if (!isNativePushSupported()) {
    return { error: { message: 'Las notificaciones push reales solo estan disponibles en la app movil.' } };
  }

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') {
    return { error: { message: 'Permiso de notificaciones denegado en el dispositivo.' } };
  }

  await PushNotifications.removeAllListeners();
  const token = await new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('No se pudo obtener el token del dispositivo.')), 15000);

    PushNotifications.addListener('registration', (nextToken) => {
      window.clearTimeout(timeout);
      resolve(nextToken.value);
    });

    PushNotifications.addListener('registrationError', (error) => {
      window.clearTimeout(timeout);
      reject(new Error(error?.error || 'No se pudo registrar el dispositivo.'));
    });

    PushNotifications.register();
  });

  const record = buildNativeRecord(token, userId);
  const { error } = await supabase
    .from('mobile_push_devices')
    .upsert(record, { onConflict: 'token' });

  if (error) return { error };
  const preferences = await savePushPreferences(supabase, userId, { ...DEFAULT_PREFERENCES, enabled: true });
  if (preferences.error) return { error: preferences.error };
  return { data: record, error: null };
}

export async function disablePushDevice(supabase, userId) {
  if (isNativePushSupported()) {
    const devices = await listPushDevices(supabase, userId);
    const platform = Capacitor.getPlatform();
    const activeDevices = (devices.data || []).filter((device) => device.platform === platform && device.enabled);
    await Promise.all(activeDevices.map((device) => supabase
      .from('mobile_push_devices')
      .update({ enabled: false })
      .eq('id', device.id)));
    await PushNotifications.removeAllListeners();
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
