-- FinTrack Pro - Reparar errores 500 por recursion en RLS
-- Ejecutar completo en Supabase SQL Editor.
--
-- Sintoma:
--   GET /profiles, /clientes, /cuentas, /deudas, /user_permissions devuelve 500.
--
-- Causa probable:
--   Politicas RLS que consultan public.profiles desde politicas de public.profiles
--   o desde politicas de tablas que conviven con politicas antiguas basadas en profiles.
--
-- Este script elimina politicas recursivas/con conflicto y deja reglas simples:
--   - profiles: cada usuario lee/actualiza su propio perfil.
--   - tablas financieras: owner por admin_id = auth.uid().
--   - user_permissions: admin_id gestiona, user_id lee sus permisos.

alter table public.profiles enable row level security;
alter table public.clientes enable row level security;
alter table public.cuentas enable row level security;
alter table public.deudas enable row level security;
alter table public.pagos enable row level security;
alter table public.movimientos enable row level security;
alter table public.user_permissions enable row level security;

-- Quitar politicas de profiles que se consultan a si mismas o se solapan.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "Users manage own profile" on public.profiles;
drop policy if exists "Client views own profile" on public.profiles;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

grant select on public.profiles to authenticated;
grant update (
  nombre,
  apellido,
  telefono,
  empresa,
  moneda,
  tipo_doc,
  documento,
  email_contacto,
  direccion,
  pin_hash,
  pin_salt,
  pin_updated_at,
  updated_at
) on public.profiles to authenticated;

-- Quitar politicas antiguas que usan EXISTS contra profiles.
drop policy if exists "Admin manages clientes" on public.clientes;
drop policy if exists "Client views own deudas" on public.deudas;
drop policy if exists "Client views own pagos" on public.pagos;
drop policy if exists "Admin manages cuentas" on public.cuentas;
drop policy if exists "Admin manages deudas" on public.deudas;
drop policy if exists "Admin manages pagos" on public.pagos;
drop policy if exists "User manages own clientes" on public.clientes;
drop policy if exists "User manages own cuentas" on public.cuentas;
drop policy if exists "User manages own deudas" on public.deudas;
drop policy if exists "User manages own pagos" on public.pagos;
drop policy if exists "User manages own movimientos" on public.movimientos;

-- Quitar politicas nuevas para recrearlas sin duplicados.
drop policy if exists "clientes_admin_all" on public.clientes;
drop policy if exists "cuentas_admin_all" on public.cuentas;
drop policy if exists "deudas_admin_all" on public.deudas;
drop policy if exists "pagos_admin_all" on public.pagos;
drop policy if exists "movimientos_admin_all" on public.movimientos;

create policy "clientes_admin_all"
on public.clientes for all
to authenticated
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

create policy "cuentas_admin_all"
on public.cuentas for all
to authenticated
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

create policy "deudas_admin_all"
on public.deudas for all
to authenticated
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

create policy "pagos_admin_all"
on public.pagos for all
to authenticated
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

create policy "movimientos_admin_all"
on public.movimientos for all
to authenticated
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

grant select, insert, update, delete on public.clientes to authenticated;
grant select, insert, update, delete on public.cuentas to authenticated;
grant select, insert, update, delete on public.deudas to authenticated;
grant select, insert, update, delete on public.pagos to authenticated;
grant select, insert, update, delete on public.movimientos to authenticated;

-- Permisos por usuario sin consultar profiles.
drop policy if exists "admin manage permissions" on public.user_permissions;
drop policy if exists "users read own permissions" on public.user_permissions;
drop policy if exists "user_permissions_admin_all" on public.user_permissions;

create policy "user_permissions_admin_all"
on public.user_permissions for all
to authenticated
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

create policy "user_permissions_read_own"
on public.user_permissions for select
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.user_permissions to authenticated;

-- Recargar cache de PostgREST.
notify pgrst, 'reload schema';

-- Diagnostico: no debe devolver error.
select 'profiles_ok' as check_name, count(*) as rows_visible
from public.profiles
where id = auth.uid();
