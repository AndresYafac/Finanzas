-- FinTrack Pro - Revision y refuerzo de RLS
-- Ejecutar en Supabase SQL Editor.
-- Este script no desactiva RLS. Habilita RLS y crea politicas basicas por admin_id/id.

alter table public.profiles enable row level security;
alter table public.clientes enable row level security;
alter table public.cuentas enable row level security;
alter table public.deudas enable row level security;
alter table public.pagos enable row level security;
alter table public.movimientos enable row level security;
alter table public.prestamos_recibidos enable row level security;
alter table public.pagos_prestamos_recibidos enable row level security;
alter table public.user_permissions enable row level security;
alter table public.auditoria enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "clientes_admin_all" on public.clientes;
create policy "clientes_admin_all"
on public.clientes for all
to authenticated
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

drop policy if exists "cuentas_admin_all" on public.cuentas;
create policy "cuentas_admin_all"
on public.cuentas for all
to authenticated
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

drop policy if exists "deudas_admin_all" on public.deudas;
create policy "deudas_admin_all"
on public.deudas for all
to authenticated
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

drop policy if exists "pagos_admin_all" on public.pagos;
create policy "pagos_admin_all"
on public.pagos for all
to authenticated
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

drop policy if exists "movimientos_admin_all" on public.movimientos;
create policy "movimientos_admin_all"
on public.movimientos for all
to authenticated
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

drop policy if exists "prestamos_recibidos_admin_all" on public.prestamos_recibidos;
create policy "prestamos_recibidos_admin_all"
on public.prestamos_recibidos for all
to authenticated
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

drop policy if exists "pagos_prestamos_recibidos_admin_all" on public.pagos_prestamos_recibidos;
create policy "pagos_prestamos_recibidos_admin_all"
on public.pagos_prestamos_recibidos for all
to authenticated
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

drop policy if exists "user_permissions_admin_all" on public.user_permissions;
create policy "user_permissions_admin_all"
on public.user_permissions for all
to authenticated
using (admin_id = auth.uid())
with check (admin_id = auth.uid());

drop policy if exists "auditoria_admin_select" on public.auditoria;
create policy "auditoria_admin_select"
on public.auditoria for select
to authenticated
using (admin_id = auth.uid());

drop policy if exists "auditoria_admin_insert" on public.auditoria;
create policy "auditoria_admin_insert"
on public.auditoria for insert
to authenticated
with check (admin_id = auth.uid());

-- Diagnostico rapido de RLS activo.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'clientes',
    'cuentas',
    'deudas',
    'pagos',
    'movimientos',
    'prestamos_recibidos',
    'pagos_prestamos_recibidos',
    'user_permissions',
    'auditoria'
  )
order by tablename;
