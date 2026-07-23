# Pendientes manuales de seguridad

## Implementado en codigo

- CAPTCHA web opcional con Cloudflare Turnstile para login y registro.
- Auditoria de inicio de sesion, registro, cierre de sesion y cambios de usuarios/permisos.
- CSP preparada para permitir Turnstile sin abrir scripts de terceros innecesarios.
- Bloqueo local de intentos fallidos ya existente en el controlador de autenticacion.

## Configuracion pendiente en servicios externos

### 1. Cloudflare Turnstile

1. Crear un widget para `finanzas-iota-hazel.vercel.app`.
2. Agregar tambien `localhost` si se quiere probar en desarrollo.
3. Copiar la site key en Vercel como `VITE_TURNSTILE_SITE_KEY`.
4. Copiar la secret key en Supabase Auth > Bot and Abuse Protection > CAPTCHA.
5. Redesplegar Vercel.

Sin `VITE_TURNSTILE_SITE_KEY`, el login sigue funcionando sin CAPTCHA para no bloquear el sistema.

### 2. Supabase Auth

Revisar y activar segun disponibilidad del plan:

- Rate limits de login y registro.
- Proteccion contra contrasenas filtradas.
- Confirmacion de correo.
- Limites de envio de correos.

### 3. Rotacion de secretos

Rotar si fueron expuestos en capturas, consola o repositorio:

- Cuenta de servicio de Firebase.
- Token de APISPERU.
- Cualquier clave `service_role` de Supabase.

La anon key de Supabase puede estar en frontend. La `service_role` nunca debe ir al navegador.

### 4. Auditoria SQL

Verificar que existe `registrar_auditoria_avanzada`. Si no existe, ejecutar el SQL de auditoria del proyecto.

### 5. Pruebas recomendadas

- Login con credenciales incorrectas hasta bloqueo.
- Registro con correo duplicado.
- Usuario desactivado.
- Usuario eliminado.
- Cierre manual de sesion.
- Cierre por inactividad.
- Cambio de permisos de un usuario.

### 6. Dominio futuro

Si luego se agrega dominio propio, actualizar:

- Turnstile domains.
- Vercel variables.
- Supabase Authentication > URL Configuration.
- Android redirect/deep links si cambia el esquema o dominio.
