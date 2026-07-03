alter table public.profiles
  add column if not exists pin_hash text,
  add column if not exists pin_salt text,
  add column if not exists pin_updated_at timestamptz;

comment on column public.profiles.pin_hash is 'Hash SHA-256 del PIN movil de 6 digitos. No guardar PIN en texto plano.';
comment on column public.profiles.pin_salt is 'Salt aleatorio usado para calcular el hash del PIN movil.';
comment on column public.profiles.pin_updated_at is 'Fecha de ultima actualizacion del PIN movil.';

alter table public.profiles enable row level security;

drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile"
on public.profiles for all
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

grant select on public.profiles to authenticated;

grant update (
  nombre, apellido, tipo_doc, documento, email_contacto,
  telefono, direccion, empresa, moneda, updated_at,
  pin_hash, pin_salt, pin_updated_at
) on public.profiles to authenticated;

notify pgrst, 'reload schema';
