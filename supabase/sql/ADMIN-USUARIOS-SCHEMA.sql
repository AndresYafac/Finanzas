-- Administracion segura de usuarios desde FinTrack.
-- El boton eliminar borra realmente el usuario de auth.users.

alter table public.profiles
  add column if not exists activo boolean not null default true,
  add column if not exists deleted_at timestamptz;

grant select on public.profiles to authenticated;
grant update (activo, deleted_at, updated_at) on public.profiles to authenticated;

create or replace function public.es_admin_actual()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and coalesce(activo, true) = true
      and deleted_at is null
  );
$$;

create or replace function public.admin_listar_usuarios()
returns table (
  id uuid,
  nombre text,
  apellido text,
  tipo_doc text,
  documento text,
  email_contacto text,
  telefono text,
  direccion text,
  empresa text,
  moneda text,
  role text,
  activo boolean,
  created_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  return query
  select p.id, p.nombre, p.apellido, p.tipo_doc, p.documento, p.email_contacto, p.telefono, p.direccion, p.empresa, p.moneda, p.role, p.activo, p.created_at, p.deleted_at
  from public.profiles p
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_actualizar_usuario(
  p_user_id uuid,
  p_nombre text,
  p_apellido text,
  p_tipo_doc text,
  p_documento text,
  p_email_contacto text,
  p_telefono text,
  p_direccion text,
  p_empresa text,
  p_moneda text,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No puedes editar tu propio usuario desde este modulo';
  end if;

  if coalesce(p_role, 'user') not in ('admin', 'user') then
    raise exception 'Rol invalido';
  end if;

  update public.profiles
  set nombre = nullif(trim(p_nombre), ''),
      apellido = nullif(trim(p_apellido), ''),
      tipo_doc = nullif(trim(p_tipo_doc), ''),
      documento = nullif(trim(p_documento), ''),
      email_contacto = nullif(trim(p_email_contacto), ''),
      telefono = nullif(trim(p_telefono), ''),
      direccion = nullif(trim(p_direccion), ''),
      empresa = nullif(trim(p_empresa), ''),
      moneda = coalesce(nullif(trim(p_moneda), ''), 'PEN'),
      role = coalesce(p_role, 'user'),
      updated_at = now()
  where id = p_user_id;
end;
$$;

create or replace function public.admin_actualizar_usuario_estado(
  p_user_id uuid,
  p_activo boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No puedes modificar tu propio estado';
  end if;

  update public.profiles
  set activo = p_activo,
      deleted_at = case when p_activo then null else deleted_at end,
      updated_at = now()
  where id = p_user_id;
end;
$$;

create or replace function public.admin_eliminar_usuario(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No puedes eliminar tu propio usuario';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Usuario no encontrado';
  end if;

  delete from auth.users
  where id = p_user_id;
end;
$$;

grant execute on function public.es_admin_actual() to authenticated;
grant execute on function public.admin_listar_usuarios() to authenticated;
grant execute on function public.admin_actualizar_usuario(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_actualizar_usuario_estado(uuid, boolean) to authenticated;
grant execute on function public.admin_eliminar_usuario(uuid) to authenticated;

notify pgrst, 'reload schema';
