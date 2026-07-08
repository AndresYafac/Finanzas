# Configuracion de Supabase para login

Origen: `docs/analisis/analisis-login.md`, seccion `6.1 Configuracion de Supabase`.

Este pendiente no se resuelve solo con codigo porque depende del panel de Supabase y del proveedor de correo. Para FinTrack se usara **Resend en plan gratuito** como SMTP transaccional.

## Objetivo

Configurar Supabase Auth para que los correos de registro, confirmacion y recuperacion de contrasena salgan desde un SMTP propio, evitando depender del limite de correos incluido por defecto en Supabase.

## 1. Configurar Resend gratis

1. Crear cuenta en Resend.
2. Entrar a **Domains**.
3. Agregar el dominio que se usara para enviar correos, por ejemplo:
   - `tudominio.com`
   - `fintrack.tudominio.com`
   - `mail.tudominio.com`
4. Resend mostrara registros DNS para verificar el dominio.
5. Crear esos registros en el proveedor DNS del dominio.
6. Esperar hasta que Resend marque el dominio como verificado.
7. Crear una API Key en Resend.

Notas importantes:

- Para produccion no conviene usar un correo generico no verificado.
- El remitente debe pertenecer al dominio verificado, por ejemplo:
  - `FinTrack Pro <no-reply@tudominio.com>`
  - `Soporte FinTrack <soporte@tudominio.com>`
- En el plan gratuito se deben revisar los limites actuales directamente en Resend antes de abrir el sistema a mas usuarios.

## 2. Datos SMTP de Resend

Usar estos datos en Supabase Auth:

```text
Host: smtp.resend.com
Port: 465
Username: resend
Password: API_KEY_DE_RESEND
Sender email: no-reply@tudominio.com
Sender name: FinTrack Pro
```

Recomendacion:

- Usar puerto `465` con SSL/TLS.
- Guardar la API Key de Resend como secreto, no en el frontend.
- No usar `VITE_` para esta API key porque no debe exponerse al navegador.

## 3. Configurar SMTP en Supabase

En Supabase:

1. Ir a **Authentication**.
2. Entrar a **Settings**.
3. Buscar la seccion de **SMTP Settings** o **Custom SMTP**.
4. Activar SMTP personalizado.
5. Completar:

```text
Sender name: FinTrack Pro
Sender email: no-reply@tudominio.com
SMTP host: smtp.resend.com
SMTP port: 465
SMTP user: resend
SMTP password: API_KEY_DE_RESEND
```

6. Guardar cambios.
7. Enviar un correo de prueba si Supabase muestra esa opcion.

## 4. URLs de autenticacion en Supabase

En Supabase Auth tambien revisar las URLs permitidas.

### Site URL

Debe ser la URL publicada de Vercel:

```text
https://tu-app.vercel.app
```

Si luego usas dominio propio:

```text
https://app.tudominio.com
```

### Redirect URLs

Agregar las URLs usadas por la app:

```text
https://tu-app.vercel.app
https://tu-app.vercel.app?recovery=1
https://app.tudominio.com
https://app.tudominio.com?recovery=1
http://localhost:5173
http://localhost:5173?recovery=1
```

Esto es importante para que el flujo de recuperacion de contrasena vuelva a la pantalla correcta de FinTrack.

## 5. Rate limiting en Supabase Auth

Revisar en Supabase Auth los limites de seguridad:

1. Limitar intentos de login por IP.
2. Limitar envio de correos por usuario/IP.
3. Revisar limites actuales del plan usado.
4. Mantener la proteccion local ya implementada en FinTrack, pero no depender solo de ella.

Configuracion recomendada inicial:

```text
Login: maximo 5 intentos fallidos por ventana corta.
Correos: limitar reenvios de confirmacion y recuperacion.
Recuperacion: evitar multiples solicitudes seguidas para el mismo email.
```

## 6. Proteccion de contrasenas filtradas

En Supabase Auth revisar si esta disponible la opcion de proteccion contra contrasenas filtradas.

Activarla si el plan/proyecto lo permite.

FinTrack ya valida contrasenas en frontend, pero esta validacion no reemplaza la proteccion del servidor.

## 7. 2FA para administradores

Pendiente de decision funcional.

Recomendacion:

1. Activar 2FA primero solo para usuarios administradores.
2. Usar TOTP si Supabase lo permite en el plan actual.
3. Documentar como recuperar acceso si un administrador pierde su dispositivo.
4. No hacerlo obligatorio para todos los usuarios hasta probarlo con pocos administradores.

## 8. Pruebas obligatorias despues de configurar Resend

Probar estos casos en produccion:

1. Registrar usuario nuevo.
2. Confirmar correo desde el enlace recibido.
3. Iniciar sesion con ese usuario.
4. Usar **Olvide mi contrasena**.
5. Abrir el enlace de recuperacion.
6. Verificar que abre la pantalla de nueva contrasena, no `Mi perfil`.
7. Cambiar contrasena.
8. Confirmar que vuelve al login.
9. Iniciar sesion con la nueva contrasena.

## 9. Checklist de cierre

- [ ] Cuenta Resend creada.
- [ ] Dominio agregado en Resend.
- [ ] DNS configurado y dominio verificado.
- [ ] API Key SMTP creada en Resend.
- [ ] SMTP configurado en Supabase.
- [ ] Site URL configurada en Supabase.
- [ ] Redirect URLs configuradas en Supabase.
- [ ] Registro probado en produccion.
- [ ] Confirmacion de correo probada en produccion.
- [ ] Recuperacion de contrasena probada en produccion.
- [ ] Limites de correo del plan gratuito revisados.

## Estado

Pendiente de ejecucion manual en Resend, DNS y Supabase.

En codigo ya existen:

- Login con Supabase Auth.
- Registro de usuarios.
- Confirmacion por correo.
- Recuperacion de contrasena.
- Pantalla separada para crear nueva contrasena.
- Proteccion local contra intentos repetidos.
- Validacion de contrasena segura.
