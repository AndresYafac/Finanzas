# Seguridad de autenticacion y sesiones

## Estado actual

FinTrack usa Supabase Auth con correo y contrasena. La sesion se mantiene en el navegador/app para permitir el flujo movil con PIN. Esto es normal, pero significa que un usuario puede quedar conectado si no cierra sesion o si comparte el dispositivo.

Cambios aplicados en codigo:

- Cliente Supabase configurado explicitamente con `persistSession`, `autoRefreshToken`, `detectSessionInUrl` y `flowType: 'pkce'`.
- Registro bloquea correos duplicados usando `auth_email_exists` y validacion de Supabase Auth.
- Login agrega bloqueo local de 5 intentos por correo durante 5 minutos. Esto mejora la experiencia, pero no reemplaza la proteccion real del servidor.
- Busqueda DNI/RUC ya no usa `VITE_APISPERU_TOKEN` desde el frontend.
- Proxy `api/documento.js` usa solo `APISPERU_TOKEN` del servidor.
- Headers de seguridad en Vercel: CSP, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`.

## Riesgo de fuerza bruta

La app no debe depender solo del bloqueo local. Un atacante podria llamar directamente a Supabase Auth sin usar la pantalla de login. La proteccion real debe estar en Supabase.

Configurar en Supabase:

1. Authentication > Rate Limits: revisar limites de login, signup y recuperacion.
2. Authentication > Attack Protection: activar protecciones disponibles del plan.
3. Authentication > Sign In / Providers: mantener confirmacion de correo activa.
4. Authentication > Passwords: usar politica de contrasena fuerte si esta disponible.

## Bots y abuso

Recomendado cuando se quiera endurecer registro/login:

1. Activar CAPTCHA/Turnstile en Supabase Auth.
2. Pasar el token CAPTCHA desde el formulario de login/registro a Supabase.
3. Limitar endpoints de Edge Functions con `ALLOWED_ORIGINS`.
4. Mantener secretos solo como Supabase Secrets o variables server-side de Vercel.

No usar secretos con prefijo `VITE_` salvo claves publicas. Cualquier `VITE_` se empaqueta en el JavaScript del navegador.

## Sesiones y suplantacion

Supabase guarda tokens de sesion en el storage del navegador/app. Si un usuario deja su sesion abierta en un equipo compartido, otra persona podria usar esa sesion.

Medidas actuales:

- Opcion de cerrar sesion.
- Opcion de cerrar sesion en todos los dispositivos desde Seguridad.
- En app movil, el PIN bloquea el acceso visual aunque la sesion siga existiendo.
- Si hay credenciales invalidas para una cuenta recordada, se limpia la cuenta recordada localmente.

Recomendado:

- Usar "Cerrar sesion en todos" si se pierde un dispositivo.
- No activar "recordar cuenta" en equipos compartidos.
- Revisar periodicamente sesiones desde Supabase si se sospecha acceso indebido.

## Pendientes recomendados

- Activar CAPTCHA/Turnstile para login y registro.
- Mover operaciones criticas a Edge Functions con validacion de permisos en backend.
- Rotar el token de APIsPeru si alguna vez estuvo en una variable `VITE_` o fue compartido.
- Agregar auditoria visible para inicio de sesion, cierre de sesion y cambios de permisos.
