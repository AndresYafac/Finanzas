import { BIOMETRIC_ENABLED_KEY } from '../constants/authStorage';
import { isNativeApp } from './platform.service';
import { storage } from './storage.service';

async function loadNativeBiometric() {
  if (!isNativeApp()) return null;
  try {
    const module = await import('capacitor-native-biometric');
    return module.NativeBiometric;
  } catch {
    return null;
  }
}

export function isBiometricEnabled() {
  return storage.getRaw(BIOMETRIC_ENABLED_KEY) === '1';
}

export function setBiometricEnabled(enabled) {
  if (enabled) return storage.setRaw(BIOMETRIC_ENABLED_KEY, '1');
  return storage.remove(BIOMETRIC_ENABLED_KEY);
}

export async function getBiometricAvailability() {
  const NativeBiometric = await loadNativeBiometric();
  if (!NativeBiometric) {
    return { available: false, reason: 'La biometria nativa solo esta disponible en la app Android.' };
  }

  try {
    const result = await NativeBiometric.isAvailable();
    return {
      available: !!result?.isAvailable,
      type: result?.biometryType || result?.biometricType || 'native',
      reason: result?.isAvailable ? '' : 'Este dispositivo no tiene biometria o bloqueo seguro configurado.',
    };
  } catch (error) {
    return {
      available: false,
      reason: error?.message || 'No se pudo validar la biometria del dispositivo.',
    };
  }
}

export async function verifyNativeBiometric() {
  const NativeBiometric = await loadNativeBiometric();
  if (!NativeBiometric) {
    return { ok: false, error: 'La biometria nativa solo esta disponible en la app Android.' };
  }

  try {
    await NativeBiometric.verifyIdentity({
      title: 'FinTrack Pro',
      subtitle: 'Desbloquear cuenta',
      description: 'Usa tu huella, rostro o bloqueo del dispositivo para continuar.',
      reason: 'Desbloquear FinTrack Pro',
      negativeButtonText: 'Cancelar',
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Validacion biometrica cancelada.',
    };
  }
}
