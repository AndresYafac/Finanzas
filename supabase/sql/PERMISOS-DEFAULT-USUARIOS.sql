-- FinTrack Pro - permisos iniciales para usuarios nuevos.
-- Ejecutar en Supabase SQL Editor.
--
-- Regla:
-- - El primer usuario admin no necesita permisos porque el rol admin tiene acceso total.
-- - Todo usuario normal nuevo recibe acceso completo a los grupos:
--   Principal: Dashboard, Clientes
--   Dinero: Cuentas y caja, Movimientos de caja, Caja diaria, Plantillas, Categorias inteligentes
-- - Los demas grupos quedan sin permisos hasta que el admin los active.

create or replace function public.crear_permisos_default_usuario(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_role text;
begin
  select role
    into v_role
  from public.profiles
  where id = p_user_id
    and deleted_at is null;

  if coalesce(v_role, 'user') = 'admin' then
    return;
  end if;

  select id
    into v_admin_id
  from public.profiles
  where role = 'admin'
    and coalesce(activo, true) = true
    and deleted_at is null
  order by created_at asc, id asc
  limit 1;

  if v_admin_id is null then
    return;
  end if;

  insert into public.user_permissions (
    admin_id,
    user_id,
    modulo,
    can_view,
    can_create,
    can_edit,
    can_delete,
    can_export
  )
  select
    v_admin_id,
    p_user_id,
    modulo,
    true,
    true,
    true,
    true,
    true
  from (
    values
      ('dashboard'),
      ('clientes'),
      ('cuentas'),
      ('movimientos'),
      ('caja-diaria'),
      ('plantillas'),
      ('categorias-inteligentes')
  ) as permisos(modulo)
  on conflict (user_id, modulo) do update
    set admin_id = excluded.admin_id,
        can_view = excluded.can_view,
        can_create = excluded.can_create,
        can_edit = excluded.can_edit,
        can_delete = excluded.can_delete,
        can_export = excluded.can_export,
        updated_at = now();
end;
$$;

drop trigger if exists trg_crear_permisos_default_usuario on public.profiles;
drop function if exists public.handle_crear_permisos_default_usuario();

create or replace function public.handle_crear_permisos_default_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.crear_permisos_default_usuario(new.id);
  return new;
end;
$$;

create trigger trg_crear_permisos_default_usuario
after insert on public.profiles
for each row
execute function public.handle_crear_permisos_default_usuario();

-- Backfill para usuarios existentes que aun no tengan permisos.
select public.crear_permisos_default_usuario(id)
from public.profiles
where role = 'user'
  and deleted_at is null
  and not exists (
    select 1
    from public.user_permissions up
    where up.user_id = profiles.id
  );

grant execute on function public.crear_permisos_default_usuario(uuid) to authenticated;
