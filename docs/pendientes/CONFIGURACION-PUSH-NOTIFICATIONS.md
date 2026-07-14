# Configuracion de Push Notifications

Estado: implementacion base creada. Falta configurar claves VAPID y desplegar la funcion.

## 1. Ejecutar SQL

En Supabase SQL Editor ejecutar:

```sql
-- Archivo:
-- supabase/sql/PUSH-NOTIFICATIONS-SCHEMA.sql
```

Esto crea:

- `push_subscriptions`
- `push_preferences`
- politicas RLS para que cada usuario administre sus dispositivos

## 2. Crear claves VAPID

Desde la carpeta del proyecto:

```powershell
npx web-push generate-vapid-keys
```

El comando genera:

- Public Key
- Private Key

## 3. Configurar Vercel

Agregar variable de entorno en Production:

```text
VITE_VAPID_PUBLIC_KEY=PUBLIC_KEY_GENERADA
```

Luego redeploy.

## 4. Configurar Supabase Edge Function

Configurar secrets:

```powershell
npx supabase secrets set VAPID_PUBLIC_KEY=PUBLIC_KEY_GENERADA
npx supabase secrets set VAPID_PRIVATE_KEY=PRIVATE_KEY_GENERADA
npx supabase secrets set VAPID_SUBJECT=mailto:tu-correo@dominio.com
```

Desplegar funcion:

```powershell
npx supabase functions deploy send-push
```

## 5. Probar

1. Abrir FinTrack publicado en HTTPS.
2. Entrar a `Sistema > Notificaciones`.
3. Presionar `Activar en este dispositivo`.
4. Aceptar permiso del navegador.
5. Presionar `Enviar prueba`.

## Notas importantes

- En Android funciona con Chrome y PWA instalada.
- En iPhone requiere instalar la app desde Safari como PWA.
- Si el usuario bloquea permisos, debe habilitarlos manualmente desde la configuracion del navegador.
- Las alertas automaticas programadas aun requieren una funcion adicional tipo `process-alerts` con cron.
