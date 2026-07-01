-- Ejecuta esto en Supabase > SQL Editor si al guardar Mi perfil aparece HTTP 400.
-- Causa comun: la tabla profiles no tiene las columnas nuevas o PostgREST aun no recargo el schema.

alter table public.profiles add column if not exists tipo_doc text not null default 'DNI';
alter table public.profiles add column if not exists documento text;
alter table public.profiles add column if not exists email_contacto text;
alter table public.profiles add column if not exists telefono text;
alter table public.profiles add column if not exists direccion text;
alter table public.profiles add column if not exists empresa text;
alter table public.profiles add column if not exists moneda text not null default 'PEN';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.profiles drop constraint if exists profiles_moneda_check;
alter table public.profiles add constraint profiles_moneda_check check (moneda in ('PEN', 'USD', 'EUR'));

alter table public.profiles enable row level security;

drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile"
on public.profiles for all
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

revoke insert, update on public.profiles from authenticated;

grant select on public.profiles to authenticated;

grant insert (
  id, nombre, apellido, tipo_doc, documento, email_contacto,
  telefono, direccion, empresa, moneda, created_at, updated_at
) on public.profiles to authenticated;

grant update (
  nombre, apellido, tipo_doc, documento, email_contacto,
  telefono, direccion, empresa, moneda, updated_at
) on public.profiles to authenticated;

notify pgrst, 'reload schema';
