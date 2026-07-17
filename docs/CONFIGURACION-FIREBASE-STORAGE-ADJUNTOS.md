# Firebase Storage para adjuntos

## Estado actual

Pendiente / desactivado temporalmente.

Firebase Storage esta preparado en codigo, pero no se activa porque Firebase pide actualizar el proyecto a plan Blaze para usar Storage. Por ahora la interfaz muestra el modulo de comprobantes como pendiente y no intenta subir archivos.

Cuando se defina el proveedor final, se puede reactivar:

- Supabase Storage, si se quiere mantener todo dentro de Supabase.
- Firebase Storage con plan Blaze.
- Cloudflare R2, S3 u otro storage externo.

La decision recomendada por ahora es no activar Blaze hasta tener claro el volumen real de archivos.

---

FinTrack usa Supabase como base de datos principal y Firebase Storage solo para guardar archivos fisicos.

## Flujo implementado

1. El usuario adjunta un PDF o imagen desde FinTrack.
2. La app valida tipo y tamano maximo de 5 MB.
3. El archivo se sube a Firebase Storage.
4. Supabase guarda el registro en `public.file_attachments`:
   - `admin_id`
   - `module`
   - `record_id`
   - `path`
   - `file_name`
   - `file_type`
   - `file_size`
   - `created_by`

## Variables necesarias

Configura estas variables en `.env.local` y tambien en Vercel:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Estas variables son publicas del SDK web. No uses aqui el JSON privado de la cuenta de servicio.

## Firebase Auth anonimo

Activa el proveedor anonimo en Firebase:

Authentication > Sign-in method > Anonymous > Enable

Esto permite que las reglas de Storage exijan `request.auth != null` sin pedir otro login al usuario.

## Reglas iniciales de Storage

Usa reglas conservadoras para no dejar el bucket completamente publico:

```js
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /fintrack/{adminId}/{module}/{recordId}/{fileName} {
      allow read, write: if request.auth != null
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*|application/pdf');
      allow delete: if request.auth != null;
    }
  }
}
```

## Pendiente de seguridad avanzada

La validacion de propietario real sigue viviendo en Supabase mediante `file_attachments` y RLS.
Para seguridad mas estricta, el siguiente paso es mover la subida a una Supabase Edge Function que valide la sesion Supabase y genere una URL firmada de Firebase/Google Cloud Storage.
