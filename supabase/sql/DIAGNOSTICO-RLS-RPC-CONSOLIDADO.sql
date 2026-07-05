-- FinTrack Pro - Diagnostico consolidado RLS/RPC
-- Este script no modifica datos ni politicas.
-- Ejecutar en Supabase SQL Editor para revisar el estado de seguridad.

select
  'rls_tables' as section,
  schemaname,
  tablename,
  rowsecurity::text as status
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'clientes',
    'cuentas',
    'deudas',
    'pagos',
    'movimientos',
    'tipos_movimiento',
    'presupuestos',
    'metas',
    'transferencias',
    'prestamos_recibidos',
    'pagos_prestamos_recibidos',
    'user_permissions',
    'auditoria',
    'empresa_config'
  )
order by tablename;

select
  'policies' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'clientes',
    'cuentas',
    'deudas',
    'pagos',
    'movimientos',
    'tipos_movimiento',
    'presupuestos',
    'metas',
    'transferencias',
    'prestamos_recibidos',
    'pagos_prestamos_recibidos',
    'user_permissions',
    'auditoria',
    'empresa_config'
  )
order by tablename, policyname;

select
  'rpc_functions' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  case p.prosecdef when true then 'security definer' else 'security invoker' end as security_mode,
  p.proconfig as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'registrar_pago',
    'actualizar_pago',
    'eliminar_pago',
    'registrar_transferencia',
    'registrar_movimiento_financiero',
    'actualizar_movimiento_financiero',
    'eliminar_movimiento_financiero',
    'registrar_deuda_con_desembolso',
    'actualizar_prestamo',
    'eliminar_prestamo',
    'registrar_prestamo_recibido',
    'actualizar_prestamo_recibido',
    'eliminar_prestamo_recibido',
    'registrar_pago_prestamo_recibido',
    'actualizar_pago_prestamo_recibido',
    'eliminar_pago_prestamo_recibido',
    'admin_listar_usuarios',
    'admin_actualizar_usuario',
    'admin_actualizar_usuario_estado',
    'admin_eliminar_usuario',
    'registrar_auditoria_avanzada',
    'tiene_permiso'
  )
order by p.proname;

select
  'rpc_grants' as section,
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and grantee in ('authenticated', 'anon')
order by routine_name, grantee, privilege_type;
