# Pendiente: Configuración de Supabase para login

Origen: `docs/analisis/analisis-login.md`, sección `6.1 Configuración de Supabase`.

Este pendiente no se implementó en código porque requiere cambios manuales en el panel de Supabase y decisiones de infraestructura.

## Acciones pendientes

1. Habilitar rate limiting en Supabase Auth.
   - Limitar intentos de login por IP.
   - Limitar envío de correos.
   - Revisar límites actuales del plan usado.

2. Configurar SMTP propio.
   - Usar un proveedor externo para correos transaccionales.
   - Configurar SPF, DKIM y DMARC.
   - Evitar depender del límite de correos de Supabase.

3. Revisar 2FA en Supabase.
   - Evaluar TOTP para usuarios administradores.
   - Definir si será obligatorio u opcional.
   - Documentar recuperación de cuenta.

4. Habilitar protección de contraseñas filtradas.
   - Revisar opción de leaked password protection en Supabase Auth.
   - Validar impacto en registro y cambio de contraseña.

## Nota

En el código se agregó protección local contra intentos repetidos y validación de contraseña, pero la protección real contra fuerza bruta debe configurarse también del lado de Supabase.
