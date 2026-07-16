import { NativeBiometric } from 'capacitor-native-biometric';
import { registerPlugin } from '@capacitor/core';
import { BIOMETRIC_ENABLED_KEY } from '../constants/authStorage';
import { isNativeApp } from './platform.service';
import { storage } from './storage.service';

const BIOMETRIC_TIMEOUT_MS = 30000;
const FintrackBiometric = registerPlugin('FintrackBiometric');

function withTimeout(promise, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), BIOMETRIC_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function getNativeErrorMessage(error, fallback) {
  const code = Number(error?.code ?? error?.errorCode);
  const messages = {
    1: 'Biometria no disponible en este dispositivo.',
    2: 'Biometria bloqueada temporalmente por demasiados intentos.',
    3: 'No hay huella o bloqueo seguro configurado en el dispositivo.',
    4: 'Biometria bloqueada temporalmente. Intenta nuevamente en unos segundos.',
    5: 'Validacion biometrica cancelada.',
    7: 'Demasiados intentos fallidos. Intenta mas tarde.',
    9: 'Biometria bloqueada. Usa el PIN del dispositivo.',
    10: 'No se pudo validar la biometria.',
    11: 'No hay huella o bloqueo seguro configurado en el dispositivo.',
    12: 'El hardware biometrico no esta disponible temporalmente.',
    13: 'Validacion biometrica cancelada.',
    14: 'El dispositivo no tiene PIN, patron o bloqueo seguro configurado.',
    16: 'Validacion biometrica cancelada.',
  };
  return messages[code] || error?.message || fallback;
}

function loadNativeBiometric() {
  if (!isNativeApp()) return null;
  console.info('[FinTrack][Biometric] Native app detected, using FintrackBiometric plugin');
  return FintrackBiometric || NativeBiometric;
}

export function isBiometricEnabled() {
  return storage.getRaw(BIOMETRIC_ENABLED_KEY) === '1';
}

export function setBiometricEnabled(enabled) {
  if (enabled) return storage.setRaw(BIOMETRIC_ENABLED_KEY, '1');
  return storage.remove(BIOMETRIC_ENABLED_KEY);
}

export async function getBiometricAvailability() {
  const biometricPlugin = loadNativeBiometric();
  if (!biometricPlugin?.isAvailable) {
    return { available: false, reason: 'La biometria nativa no esta disponible en esta instalacion de la app.' };
  }

  try {
    console.info('[FinTrack][Biometric] Checking availability');
    const result = await withTimeout(
      biometricPlugin.isAvailable({ useFallback: true }),
      'Android no respondio a la validacion biometrica. Actualiza la app o vuelve a sincronizar Capacitor.',
    );
    console.info('[FinTrack][Biometric] Availability result', result);
    return {
      available: !!(result?.available ?? result?.isAvailable),
      type: result?.biometryType || result?.biometricType || 'native',
      reason: (result?.available ?? result?.isAvailable) ? '' : result?.reason || 'Este dispositivo no tiene biometria o bloqueo seguro configurado.',
    };
  } catch (error) {
    console.error('[FinTrack][Biometric] Availability error', error);
    return {
      available: false,
      reason: getNativeErrorMessage(error, 'No se pudo validar la biometria del dispositivo.'),
    };
  }
}

export async function verifyNativeBiometric() {
  const biometricPlugin = loadNativeBiometric();
  if (!biometricPlugin?.verifyIdentity) {
    return { ok: false, error: 'La biometria nativa no esta disponible en esta instalacion de la app.' };
  }

  try {
    console.info('[FinTrack][Biometric] Opening native prompt');
    await withTimeout(
      biometricPlugin.verifyIdentity({
        title: 'FinTrack Pro',
        subtitle: 'Desbloquear cuenta',
        description: 'Usa tu huella, rostro o bloqueo del dispositivo para continuar.',
        negativeButtonText: 'Cancelar',
        useFallback: true,
        maxAttempts: 3,
      }),
      'Android no abrio el dialogo biometrico. Cierra y vuelve a abrir la app o reinstala el APK actualizado.',
    );
    console.info('[FinTrack][Biometric] Native prompt approved');
    return { ok: true };
  } catch (error) {
    console.error('[FinTrack][Biometric] Native prompt error', error);
    return {
      ok: false,
      error: getNativeErrorMessage(error, 'Validacion biometrica cancelada.'),
    };
  }
}
