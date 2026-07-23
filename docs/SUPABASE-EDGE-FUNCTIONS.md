# Supabase Edge Functions

## Funciones implementadas

Se agregaron estas funciones:

```text
supabase/functions/lookup-document/index.ts
supabase/functions/admin-delete-user/index.ts
supabase/functions/recalculate-balances/index.ts
supabase/functions/validate-operation/index.ts
supabase/functions/export-report/index.ts
supabase/functions/webauthn/index.ts
```

Objetivos:

- `lookup-document`: consulta DNI/RUC usando APIsPeru sin exponer `APISPERU_TOKEN`.
- `admin-delete-user`: elimina usuarios reales de Supabase Auth usando `service_role` solo en backend.
- `recalculate-balances`: sincroniza billeteras vinculadas con el saldo real de su banco.
- `validate-operation`: valida reglas criticas antes de operaciones financieras.
- `export-report`: genera reportes desde backend para tablas permitidas.
- `webauthn`: registra y valida Passkeys/WebAuthn para desbloqueo biometrico de una sesion recordada.

No se implemento envio de correos porque SMTP/Resend queda pendiente.

## Configuracion inicial

Desde la raiz del proyecto:

```bash
npx supabase login
npx supabase link --project-ref vtxlopsqjzovvfsslcef
```

Configurar el token como secreto:

```bash
npx supabase secrets set APISPERU_TOKEN=tu_token_apisperu
```

Opcional para restringir origenes:

```bash
npx supabase secrets set ALLOWED_ORIGINS=https://finanzas-iota-hazel.vercel.app,http://127.0.0.1:5173
```

Si no configuras `ALLOWED_ORIGINS`, la funcion permite `*`.

## Publicar funcion

```bash
npx supabase functions deploy lookup-document
npx supabase functions deploy admin-delete-user
npx supabase functions deploy recalculate-balances
npx supabase functions deploy validate-operation
npx supabase functions deploy export-report
npx supabase functions deploy webauthn
```

## Flujo en frontend

`src/services/documentLookup.service.js` ahora intenta en este orden:

1. `supabase.functions.invoke('lookup-document')`
2. `VITE_DOCUMENT_LOOKUP_URL`, si existe
3. `/api/documento` en produccion como respaldo de Vercel

No se debe usar `VITE_APISPERU_TOKEN`. Toda variable con prefijo `VITE_` queda visible en el navegador.

`src/services/admin.service.js` ahora intenta eliminar usuarios con:

```text
supabase.functions.invoke('admin-delete-user')
```

Si la funcion todavia no esta desplegada, usa temporalmente el RPC anterior como respaldo para no romper el sistema mientras publicas las funciones.

`src/services/backend.service.js` deja disponibles helpers para:

```text
recalculateBalances()
validateFinanceOperation()
exportBackendReport()
```

## Variables recomendadas en Vercel

Mantener:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

No crear ni usar:

```text
VITE_APISPERU_TOKEN
```

## Probar localmente

Con Supabase CLI:

```bash
npx supabase functions serve lookup-document --env-file .env.local
```

Luego probar desde la app o con una llamada POST a:

```text
http://127.0.0.1:54321/functions/v1/lookup-document
```

Body:

```json
{
  "tipo": "dni",
  "documento": "12345678"
}
```

## Probar eliminacion real de usuarios

Desde la app, entra como administrador y elimina un usuario que no sea tu cuenta actual.

Resultado esperado:

- Se borra de `auth.users`.
- Se borra su `profile` por cascada.
- Se limpian sus permisos.
- Si estaba vinculado a un cliente, el cliente queda sin `user_id`.

## Probar sincronizacion de saldos

Ejemplo con la funcion desplegada:

```bash
curl -X POST "https://vtxlopsqjzovvfsslcef.supabase.co/functions/v1/recalculate-balances" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{}"
```

Esta funcion solo corrige billeteras vinculadas. No recalcula saldos historicos desde cero porque el sistema no guarda un saldo inicial separado por cuenta.

## Pendientes backend recomendados

- Reemplazar poco a poco las validaciones del frontend por `validate-operation`.
- Decidir desde que pantalla se ejecutara `recalculate-balances`.
- Mover exportaciones grandes a `export-report` cuando los reportes crezcan.
- Implementar correos con Resend cuando tengas dominio verificado.

## WebAuthn / Passkeys

Estado: pendiente. Se probó, pero se retiró del flujo principal porque en algunos dispositivos Android no abría el diálogo nativo de forma confiable.

Antes de retomarlo, ejecuta:

```sql
-- Supabase SQL Editor
-- Archivo: supabase/sql/WEBAUTHN-PASSKEYS-SCHEMA.sql
```

Configura estos secretos recomendados:

```bash
npx supabase secrets set WEBAUTHN_ORIGIN=https://finanzas-iota-hazel.vercel.app
npx supabase secrets set WEBAUTHN_RP_ID=finanzas-iota-hazel.vercel.app
```

Para desarrollo local puedes usar:

```bash
npx supabase secrets set WEBAUTHN_ORIGIN=http://127.0.0.1:5173
npx supabase secrets set WEBAUTHN_RP_ID=127.0.0.1
```

Notas:

- WebAuthn necesita HTTPS en produccion. En local funciona con `localhost` o `127.0.0.1`.
- FinTrack no guarda huella ni Face ID. El dispositivo valida la biometria y la app guarda solo una clave publica.
- Esta implementacion desbloquea una sesion recordada. No reemplaza por completo el login inicial por correo y contrasena.
