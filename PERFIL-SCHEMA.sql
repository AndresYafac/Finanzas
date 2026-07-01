-- FinTrack Pro - agrega campos faltantes a Mi perfil.

alter table public.profiles add column if not exists tipo_doc text not null default 'DNI';
alter table public.profiles add column if not exists documento text;
alter table public.profiles add column if not exists email_contacto text;
alter table public.profiles add column if not exists direccion text;

revoke insert, update on public.profiles from authenticated;
grant insert (
  id, nombre, apellido, tipo_doc, documento, email_contacto,
  telefono, direccion, empresa, moneda, created_at, updated_at
) on public.profiles to authenticated;
grant update (
  nombre, apellido, tipo_doc, documento, email_contacto,
  telefono, direccion, empresa, moneda, updated_at
) on public.profiles to authenticated;
