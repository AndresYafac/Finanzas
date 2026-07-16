package com.fintrack.pro;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.util.Log;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

@CapacitorPlugin(name = "FintrackBiometric")
public class FintrackBiometricPlugin extends Plugin {
    private static final String TAG = "FinTrackBiometric";
    private static final int AUTHENTICATORS =
        BiometricManager.Authenticators.BIOMETRIC_STRONG;
    private BiometricPrompt biometricPrompt;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        try {
            Log.d(TAG, "isAvailable called");
            BiometricManager manager = BiometricManager.from(getContext());
            int result = manager.canAuthenticate(AUTHENTICATORS);
            boolean available = result == BiometricManager.BIOMETRIC_SUCCESS;
            Log.d(TAG, "isAvailable result=" + result + " available=" + available);

            JSObject response = new JSObject();
            response.put("available", available);
            response.put("code", result);
            response.put("reason", available ? "" : getReason(result));
            call.resolve(response);
        } catch (Exception exception) {
            Log.e(TAG, "isAvailable failed", exception);
            call.reject(getMessage(exception, "No se pudo validar la biometria nativa."), "0");
        }
    }

    @PluginMethod
    public void verifyIdentity(PluginCall call) {
        Log.d(TAG, "verifyIdentity called");
        Activity activity = getActivity();
        if (activity == null) {
            Log.e(TAG, "Activity is null");
            call.reject("Actividad Android no disponible.", "0");
            return;
        }

        if (!(activity instanceof FragmentActivity)) {
            Log.e(TAG, "Activity is not FragmentActivity: " + activity.getClass().getName());
            call.reject("La actividad Android no soporta BiometricPrompt.", "0");
            return;
        }

        BiometricManager manager = BiometricManager.from(getContext());
        int availability = manager.canAuthenticate(AUTHENTICATORS);
        Log.d(TAG, "verifyIdentity availability=" + availability);
        if (availability != BiometricManager.BIOMETRIC_SUCCESS) {
            call.reject(getReason(availability), String.valueOf(availability));
            return;
        }

        try {
            String title = call.getString("title", "FinTrack Pro");
            String description = call.getString("description", "Usa tu huella o bloqueo seguro para continuar.");

            Executor executor = ContextCompat.getMainExecutor(getContext());
            biometricPrompt = new BiometricPrompt((FragmentActivity) activity, executor, new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    Log.d(TAG, "Authentication succeeded");
                    JSObject response = new JSObject();
                    response.put("ok", true);
                    call.resolve(response);
                }

                @Override
                public void onAuthenticationError(int errorCode, CharSequence errString) {
                    Log.e(TAG, "Authentication error=" + errorCode + " message=" + errString);
                    call.reject(errString == null ? "Validacion biometrica cancelada." : errString.toString(), String.valueOf(errorCode));
                }

                @Override
                public void onAuthenticationFailed() {
                    Log.d(TAG, "Authentication failed, waiting for another attempt");
                    // Android permite nuevos intentos dentro del mismo prompt. No cerrar la llamada aqui.
                }
            });

            BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(call.getString("subtitle", "Desbloquear cuenta"))
                .setDescription(description)
                .setAllowedAuthenticators(AUTHENTICATORS)
                .setNegativeButtonText("Cancelar")
                .setConfirmationRequired(false)
                .build();

            activity.runOnUiThread(() -> {
                Log.d(TAG, "Opening BiometricPrompt");
                biometricPrompt.authenticate(promptInfo);
            });
        } catch (Exception exception) {
            Log.e(TAG, "verifyIdentity failed", exception);
            call.reject(getMessage(exception, "No se pudo abrir el desbloqueo seguro de Android."), "0");
        }
    }

    private String getReason(int result) {
        switch (result) {
            case BiometricManager.BIOMETRIC_SUCCESS:
                return "";
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                return "Este dispositivo no tiene hardware biometrico.";
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                return "El hardware biometrico no esta disponible temporalmente.";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                return "Configura una huella, rostro o bloqueo seguro en Android.";
            case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED:
                return "Android requiere una actualizacion de seguridad para usar biometria.";
            case BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED:
                return "La biometria no es compatible con este dispositivo.";
            case BiometricManager.BIOMETRIC_STATUS_UNKNOWN:
            default:
                return "No se pudo determinar la disponibilidad biometrica.";
        }
    }

    private String getMessage(Exception exception, String fallback) {
        String message = exception.getMessage();
        return message == null || message.trim().isEmpty() ? fallback : message;
    }

    private boolean isDeviceSecure() {
        KeyguardManager keyguardManager = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        return keyguardManager != null && keyguardManager.isDeviceSecure();
    }
}
