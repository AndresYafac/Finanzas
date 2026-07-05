-- FinTrack Pro - permisos finos por modulo y auditoria avanzada.
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.empresa_config (
  admin_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default 'FinTrack Pro',
  documento text,
  direccion text,
  telefono text,
  logo_url text,
  primary_color text default '#1d9e75',
  theme text default 'light' check (theme in ('light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.empresa_config
add column if not exists primary_color text default '#1d9e75',
add column if not exists theme text default 'light';

alter table public.empresa_config enable row level security;
grant select, insert, update, delete on public.empresa_config to authenticated;

drop policy if exists "admin manage own company config" on public.empresa_config;
create policy "admin manage own company config" on public.empresa_config
for all using (admin_id = auth.uid())
with check (admin_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('empresa-assets', 'empresa-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "read empresa assets" on storage.objects;
create policy "read empresa assets" on storage.objects
for select using (bucket_id = 'empresa-assets');

drop policy if exists "write own empresa assets" on storage.objects;
create policy "write own empresa assets" on storage.objects
for insert with check (
  bucket_id = 'empresa-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "update own empresa assets" on storage.objects;
create policy "update own empresa assets" on storage.objects
for update using (
  bucket_id = 'empresa-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  modulo text not null,
  can_view boolean not null default true,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  can_export boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, modulo)
);

alter table public.user_permissions enable row level security;
grant select, insert, update, delete on public.user_permissions to authenticated;

drop policy if exists "admin manage permissions" on public.user_permissions;
create policy "admin manage permissions" on public.user_permissions
for all using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.activo, true) = true
      and p.deleted_at is null
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.activo, true) = true
      and p.deleted_at is null
  )
);

drop policy if exists "users read own permissions" on public.user_permissions;
create policy "users read own permissions" on public.user_permissions
for select using (user_id = auth.uid());

create or replace function public.tiene_permiso(
  p_modulo text,
  p_accion text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_allowed boolean;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid()
    and coalesce(activo, true) = true
    and deleted_at is null;

  if v_role = 'admin' then
    return true;
  end if;

  select case p_accion
    when 'view' then can_view
    when 'create' then can_create
    when 'edit' then can_edit
    when 'delete' then can_delete
    when 'export' then can_export
    else false
  end into v_allowed
  from public.user_permissions
  where user_id = auth.uid()
    and modulo = p_modulo;

  return coalesce(v_allowed, false);
end;
$$;

grant execute on function public.tiene_permiso(text, text) to authenticated;

-- Nota de seguridad:
-- La tabla y funcion de permisos quedan listas para la UI.
-- No se reemplazan aqui las politicas RLS existentes de tus tablas financieras
-- para evitar bloquear usuarios o exponer datos entre administradores.
-- Si quieres endurecimiento 100% en DB, el siguiente paso correcto es mover
-- cada operacion sensible a RPC security definer validando public.tiene_permiso().

alter table public.auditoria
  add column if not exists actor_id uuid references auth.users(id) on delete set null,
  add column if not exists datos_antes jsonb,
  add column if not exists datos_despues jsonb,
  add column if not exists ip text,
  add column if not exists user_agent text;

create or replace function public.registrar_auditoria_avanzada(
  p_tabla text,
  p_accion text,
  p_descripcion text,
  p_registro_id uuid,
  p_datos_antes jsonb,
  p_datos_despues jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.auditoria (
    admin_id,
    actor_id,
    tabla,
    accion,
    descripcion,
    registro_id,
    datos,
    datos_antes,
    datos_despues
  )
  values (
    auth.uid(),
    auth.uid(),
    p_tabla,
    p_accion,
    p_descripcion,
    p_registro_id,
    p_datos_despues,
    p_datos_antes,
    p_datos_despues
  );
end;
$$;

grant execute on function public.registrar_auditoria_avanzada(text, text, text, uuid, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
