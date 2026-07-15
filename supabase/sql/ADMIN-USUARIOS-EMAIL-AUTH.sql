-- Muestra en el modulo Usuarios el correo real usado para iniciar sesion.
-- Ejecutar en Supabase SQL Editor.

drop function if exists public.admin_listar_usuarios();

create or replace function public.admin_listar_usuarios()
returns table (
  id uuid,
  nombre text,
  apellido text,
  tipo_doc text,
  documento text,
  email_auth text,
  email_confirmed_at timestamptz,
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
set search_path = public, auth
as $$
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  return query
  select
    p.id,
    p.nombre,
    p.apellido,
    p.tipo_doc,
    p.documento,
    u.email::text as email_auth,
    u.email_confirmed_at,
    p.email_contacto,
    p.telefono,
    p.direccion,
    p.empresa,
    p.moneda,
    p.role,
    p.activo,
    p.created_at,
    p.deleted_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

grant execute on function public.admin_listar_usuarios() to authenticated;

notify pgrst, 'reload schema';
