# Revision RLS y RPC - FinTrack Pro

Fecha: 2026-07-05

## Estado revisado

Se revisaron los scripts SQL existentes en `supabase/sql` relacionados con seguridad, politicas RLS y funciones RPC financieras.

Archivos principales:

- `supabase/sql/REPARAR-RLS-RECURSION-500.sql`
- `supabase/sql/RLS-AUDITORIA-REVISION.sql`
- `supabase/sql/RPC-SALDOS-TRANSACCIONALES.sql`
- `supabase/sql/MOVIMIENTOS-CUENTAS-SCHEMA.sql`
- `supabase/sql/DEUDAS-PRESTAMOS-SCHEMA.sql`
- `supabase/sql/PRESTAMOS-RECIBIDOS-SCHEMA.sql`
- `supabase/sql/TRANSFERENCIAS-SCHEMA.sql`
- `supabase/sql/ADMIN-USUARIOS-SCHEMA.sql`
- `supabase/sql/PERMISOS-AUDITORIA-AVANZADA.sql`

## Criterio de seguridad esperado

- Cada tabla financiera debe estar protegida por `admin_id = auth.uid()`.
- `profiles` debe permitir lectura/edicion solo del usuario actual.
- `user_permissions` debe permitir lectura al usuario propietario y gestion al admin propietario.
- Las RPC financieras deben validar `auth.uid()` y operar solo sobre registros del usuario autenticado.
- Las RPC que modifican saldos deben validar que la cuenta pertenece al usuario autenticado.
- Las funciones `security definer` deben tener `set search_path = public` o equivalente seguro.

## Hallazgos

- Hay scripts correctivos ya preparados para evitar recursion RLS en `profiles`.
- Las tablas financieras principales tienen politicas por `admin_id`.
- Las RPC de transferencias, movimientos, prestamos otorgados y prestamos recibidos validan pertenencia por `admin_id`.
- Las RPC de usuarios admin evitan editar/eliminar el usuario actual.
- Existe script de auditoria y permisos por modulo.

## Riesgos pendientes

- No se ejecuto validacion directa contra Supabase desde este entorno.
- Puede haber politicas antiguas duplicadas si se ejecutaron scripts viejos y nuevos varias veces.
- Las tablas nuevas deben revisarse cada vez que se agregue un modulo financiero.

## Script recomendado de diagnostico

Usar:

- `supabase/sql/DIAGNOSTICO-RLS-RPC-CONSOLIDADO.sql`

Ese script no cambia datos. Sirve para verificar RLS activo, politicas existentes, funciones RPC criticas y grants.

## Recomendacion operativa

Antes de publicar cambios de base de datos en produccion:

1. Ejecutar `DIAGNOSTICO-RLS-RPC-CONSOLIDADO.sql`.
2. Si aparecen politicas duplicadas o antiguas, ejecutar `REPARAR-RLS-RECURSION-500.sql`.
3. Ejecutar los scripts de schema que falten segun el modulo.
4. Volver a ejecutar el diagnostico.
